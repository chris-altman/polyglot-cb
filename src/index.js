// src/index.js
import { OpenAI } from "openai";
import serpSearch from "./serp.js";
import { buildSystemPrompt } from "./guidelines.js";
import { getHTMLContent, getCSSContent, getJSContent } from "./ui.js";
import { extractTextFromHTML, jsonOK, jsonError, getLocationSuggestions } from "./utils.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Serve static assets
    if (request.method === "GET") {
      if (url.pathname === "/" || url.pathname === "/index.html") {
        return new Response(getHTMLContent(), {
          headers: { "Content-Type": "text/html", ...corsHeaders }
        });
      }
      
      if (url.pathname === "/static/css/style.css") {
        return new Response(getCSSContent(), {
          headers: { "Content-Type": "text/css", ...corsHeaders }
        });
      }
      
      if (url.pathname === "/static/js/script.js") {
        return new Response(getJSContent(), {
          headers: { "Content-Type": "application/javascript", ...corsHeaders }
        });
      }

      if (url.pathname === "/location_suggest") {
        const query = url.searchParams.get('q') || '';
        const suggestions = getLocationSuggestions(query);
        return new Response(JSON.stringify(suggestions), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // Content generation endpoint
    if (request.method === "POST" && url.pathname === "/process") {
      try {
        // Check if API key is available
        if (!env.OPENAI_API_KEY) {
          return jsonError("OpenAI API key not configured on server.", corsHeaders);
        }

        const data = await request.json();
        const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY }); // Use server's API key
        
        const {
          model = "gpt-4o-mini",
          temperature = 0.7,
          max_tokens = 4000,
          market = "United States",
          lang = "en",
          input_type,
          input_content,
          article_length = "medium"
        } = data;

        // Get content based on input type
        let content;
        if (input_type === "url") {
          try {
            const res = await fetch(input_content, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            });
            const html = await res.text();
            content = extractTextFromHTML(html);
          } catch (e) {
            return jsonError(`Error fetching URL: ${e.message}`, corsHeaders);
          }
        } else {
          // Use the modular SERP search
          content = await serpSearch(input_content, market, lang, env);
        }

        // Word targets for different lengths
        const wordTargets = {
          short: "approximately 500 words",
          medium: "approximately 1500-2500 words",
          long: "approximately 3000+ words"
        };

        // Build system prompt using guidelines
        const systemMsg = buildSystemPrompt(lang, market);
        
        const messages = [
          { role: "system", content: systemMsg },
          {
            role: "user",
            content: `TARGET MARKET: ${market}
ARTICLE LENGTH: ${wordTargets[article_length]}

Write a complete article about: "${input_content}"

CRITICAL INSTRUCTIONS:
- Follow all guidelines and compliance rules from the system prompt
- Target readers in ${market}
- Do not mention this is based on provided content
- Use natural, engaging language appropriate for the target market

Research content for reference:
${content}`
          }
        ];

        const chat = await openai.chat.completions.create({
          model,
          messages,
          temperature: parseFloat(temperature),
          max_tokens: parseInt(max_tokens)
        });

        const reply = chat.choices[0].message.content;
        const session_id = crypto.randomUUID();
        
        // Store session in KV with TTL
        await env.SESSION_STORE.put(session_id, JSON.stringify({
          model, 
          messages: [...messages, { role: "assistant", content: reply }] 
        }), { expirationTtl: 3600 });

        return jsonOK({ status: "success", text: reply, session_id }, corsHeaders);
      } catch (err) {
        return jsonError(err.message, corsHeaders);
      }
    }

    // Chat continuation endpoint
    if (request.method === "POST" && url.pathname === "/continue_chat") {
      try {
        // Check if API key is available
        if (!env.OPENAI_API_KEY) {
          return jsonError("OpenAI API key not configured on server.", corsHeaders);
        }

        const data = await request.json();
        const {
          session_id, message, 
          model = "gpt-4o-mini", 
          temperature = 0.7, 
          max_tokens = 4000
        } = data;

        const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY }); // Use server's API key
        
        // Get session from KV
        const sessionData = await env.SESSION_STORE.get(session_id);
        const session = sessionData ? JSON.parse(sessionData) : null;
        
        if (!session) {
          return jsonError("Invalid or expired session_id.", corsHeaders);
        }
        if (!message) {
          return jsonError("Missing user message.", corsHeaders);
        }

        const messages = [...session.messages, { role: "user", content: message }];

        const chat = await openai.chat.completions.create({
          model,
          messages,
          temperature: parseFloat(temperature),
          max_tokens: parseInt(max_tokens)
        });

        const reply = chat.choices[0].message.content;
        
        // Update session in KV with TTL
        await env.SESSION_STORE.put(session_id, JSON.stringify({
          model, 
          messages: [...messages, { role: "assistant", content: reply }] 
        }), { expirationTtl: 3600 });

        return jsonOK({ status: "success", text: reply }, corsHeaders);
      } catch (err) {
        return jsonError(err.message, corsHeaders);
      }
    }

    return new Response("Not found", { status: 404, headers: corsHeaders });
  }
};