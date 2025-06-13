// src/index.js
import { OpenAI } from "openai";
import serpSearch from "./serp.js";
import guidelines from "./guidelines.json";

const sessionStore = new Map(); // Simple in-memory session tracker

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      const html = await fetch("/public/index.html").then(r => r.text());
      return new Response(html, {
        headers: { "Content-Type": "text/html" }
      });
    }

    if (request.method === "POST" && url.pathname === "/process") {
      const data = await request.json();
      const openai = new OpenAI({ apiKey: data.api_key });

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

      let content;
      if (input_type === "url") {
        try {
          const res = await fetch(input_content);
          const html = await res.text();
          content = html.slice(0, 10000); // placeholder for scraping
        } catch (e) {
          return jsonError(`Error fetching URL: ${e.message}`);
        }
      } else {
        content = await serpSearch(input_content, market, lang);
      }

      const wordTargets = {
        short: "approximately 500 words",
        medium: "approximately 1500-2500 words",
        long: "approximately 3000+ words"
      };

      const systemMsg = `Respond in ${lang}. ${JSON.stringify(guidelines)}`;
      const messages = [
        { role: "system", content: systemMsg },
        {
          role: "user",
          content: `User query: «${input_content}»\n\nWrite an article in ${lang} for readers in **${market}**. Length: ${wordTargets[article_length]}. Do not say 'Based on the content provided'.\n\nUse the following as background:\n${content}`
        }
      ];

      try {
        const chat = await openai.chat.completions.create({
          model,
          messages,
          temperature: parseFloat(temperature),
          max_tokens: parseInt(max_tokens)
        });

        const reply = chat.choices[0].message.content;
        const session_id = crypto.randomUUID();
        sessionStore.set(session_id, { model, messages: [...messages, { role: "assistant", content: reply }] });

        return jsonOK({ status: "success", text: reply, session_id });
      } catch (err) {
        return jsonError(err.message);
      }
    }

    if (request.method === "POST" && url.pathname === "/continue_chat") {
      const data = await request.json();
      const {
        api_key, session_id, message, model = "gpt-4o-mini", temperature = 0.7, max_tokens = 4000
      } = data;

      const openai = new OpenAI({ apiKey: api_key });
      const session = sessionStore.get(session_id);

      if (!session) return jsonError("Invalid or expired session_id.");
      if (!message) return jsonError("Missing user message.");

      const messages = [...session.messages, { role: "user", content: message }];
      try {
        const chat = await openai.chat.completions.create({
          model,
          messages,
          temperature: parseFloat(temperature),
          max_tokens: parseInt(max_tokens)
        });
        const reply = chat.choices[0].message.content;
        sessionStore.set(session_id, { model, messages: [...messages, { role: "assistant", content: reply }] });
        return jsonOK({ status: "success", text: reply });
      } catch (err) {
        return jsonError(err.message);
      }
    }

    return new Response("Not found", { status: 404 });
  }
};

function jsonOK(obj) {
  return new Response(JSON.stringify(obj), {
    headers: { "Content-Type": "application/json" },
    status: 200
  });
}

function jsonError(msg) {
  return new Response(JSON.stringify({ status: "error", message: msg }), {
    headers: { "Content-Type": "application/json" },
    status: 400
  });
}
