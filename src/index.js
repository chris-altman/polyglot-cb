// src/index.js
import { OpenAI } from "openai";

const sessionStore = new Map();

function extractTextFromHTML(html) {
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<[^>]*>/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  return text.slice(0, 8000);
}

async function serpSearch(query, location = "United States", lang = "en", env) {
  if (!env.SERPAPI_KEY) {
    return `Search results for: ${query}\n\n[Note: SERPAPI_KEY not configured, using placeholder results]`;
  }

  const endpoint = "https://serpapi.com/search.json";
  const params = new URLSearchParams({
    engine: "google",
    q: query,
    location,
    hl: lang,
    num: 3,
    api_key: env.SERPAPI_KEY
  });

  try {
    const res = await fetch(`${endpoint}?${params}`);
    const data = await res.json();
    const results = data.organic_results || [];

    return results.map((r, i) => {
      return `RESULT ${i + 1}:\nTitle: ${r.title}\nSnippet: ${r.snippet}\nLink: ${r.link}\n`;
    }).join("\n\n");

  } catch (err) {
    return `Error fetching search results: ${err.message}`;
  }
}

const guidelines = {
  style: "Professional and engaging",
  tone: "Informative yet accessible",
  structure: "Use clear headings and paragraphs",
  formatting: "Include relevant examples and explanations"
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

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

    if (request.method === "POST" && url.pathname === "/process") {
      try {
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
          content = await serpSearch(input_content, market, lang, env);
        }

        const wordTargets = {
          short: "approximately 500 words",
          medium: "approximately 1500-2500 words",
          long: "approximately 3000+ words"
        };

        const systemMsg = `You are a professional content writer. You MUST write EVERYTHING in ${lang}. Every word of your response must be in ${lang}. Never use English or any other language unless ${lang} is English. Follow these guidelines: ${JSON.stringify(guidelines)}`;
        
        const messages = [
          { role: "system", content: systemMsg },
          {
            role: "user",
            content: `LANGUAGE: ${lang}
TARGET MARKET: ${market}
ARTICLE LENGTH: ${wordTargets[article_length]}

Write a complete article about: "${input_content}"

CRITICAL INSTRUCTIONS:
- Write the ENTIRE article in ${lang}
- All headings, subheadings, and content must be in ${lang}
- Target readers in ${market}
- Do not mention this is based on provided content
- Use natural, engaging ${lang} that residents of ${market} would understand

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
        sessionStore.set(session_id, { 
          model, 
          messages: [...messages, { role: "assistant", content: reply }] 
        });

        return jsonOK({ status: "success", text: reply, session_id }, corsHeaders);
      } catch (err) {
        return jsonError(err.message, corsHeaders);
      }
    }

    if (request.method === "POST" && url.pathname === "/continue_chat") {
      try {
        const data = await request.json();
        const {
          api_key, session_id, message, 
          model = "gpt-4o-mini", 
          temperature = 0.7, 
          max_tokens = 4000
        } = data;

        const openai = new OpenAI({ apiKey: api_key });
        const session = sessionStore.get(session_id);
        
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
        sessionStore.set(session_id, { 
          model, 
          messages: [...messages, { role: "assistant", content: reply }] 
        });

        return jsonOK({ status: "success", text: reply }, corsHeaders);
      } catch (err) {
        return jsonError(err.message, corsHeaders);
      }
    }

    return new Response("Not found", { status: 404, headers: corsHeaders });
  }
};

function jsonOK(obj, corsHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
    status: 200
  });
}

function jsonError(msg, corsHeaders = {}) {
  return new Response(JSON.stringify({ status: "error", message: msg }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
    status: 400
  });
}

function getLocationSuggestions(query) {
  const locations = [
    { canonical_name: "New York, NY, United States" },
    { canonical_name: "Los Angeles, CA, United States" },
    { canonical_name: "London, England, United Kingdom" },
    { canonical_name: "Paris, France" },
    { canonical_name: "Tokyo, Japan" },
    { canonical_name: "Sydney, Australia" },
    { canonical_name: "Toronto, Canada" },
    { canonical_name: "Berlin, Germany" },
    { canonical_name: "Madrid, Spain" },
    { canonical_name: "Rome, Italy" }
  ];
  
  return locations.filter(loc => 
    loc.canonical_name.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 5);
}

function getHTMLContent() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Content Generator</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">
    <link rel="stylesheet" href="/static/css/style.css">
</head>
<body class="dark-mode">
    <div class="container mt-4">
        <h1 class="text-center mb-4">AI Content Generator</h1>

        <div class="card mb-4">
            <div class="card-header">
                <h2>Step 1: API Configuration</h2>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-12">
                        <div class="mb-3">
                            <label for="api-key" class="form-label">OpenAI API Key</label>
                            <input type="password" class="form-control" id="api-key" placeholder="Enter your OpenAI API key">
                            <div class="form-text">Your API key is used only for this session and is not stored on our server.</div>
                        </div>
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-4">
                        <div class="mb-3">
                            <label for="model" class="form-label">Model</label>
                            <select class="form-select" id="model">
                                <option value="gpt-4o-mini" selected>gpt-4o-mini • low cost / fast</option>
                                <option value="gpt-4o">gpt-4o • balanced</option>
                                <option value="gpt-4-turbo">gpt-4-turbo • large context</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="mb-3">
                            <label for="temperature" class="form-label">Temperature: <span id="temp-value">0.7</span></label>
                            <input type="range" class="form-range" id="temperature" min="0" max="2" step="0.1" value="0.7">
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="mb-3">
                            <label for="max-tokens" class="form-label">Max Tokens: <span id="token-value">4000</span></label>
                            <input type="range" class="form-range" id="max-tokens" min="2000" max="20000" step="1000" value="4000">
                        </div>
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label for="market" class="form-label">Market / Location</label>
                            <input type="text" class="form-control" id="market" list="market-suggestions" placeholder="e.g. Paris, France">
                            <datalist id="market-suggestions"></datalist>
                            <div class="form-text">City or country name for localized content.</div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label for="lang" class="form-label">Interface language (hl)</label>
                            <input type="text" class="form-control" id="lang" value="en" maxlength="5" placeholder="e.g. fr">
                            <div class="form-text">Two-letter code (en, fr, de, ja …).</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="card mb-4">
            <div class="card-header">
                <h2>Step 2: Choose Input Type</h2>
            </div>
            <div class="card-body">
                <div class="form-check form-check-inline">
                    <input class="form-check-input" type="radio" name="input-type" id="search-query" value="search">
                    <label class="form-check-label" for="search-query">Search Query</label>
                </div>
                <div class="form-check form-check-inline">
                    <input class="form-check-input" type="radio" name="input-type" id="single-url" value="url" checked>
                    <label class="form-check-label" for="single-url">Single URL</label>
                </div>
            </div>
        </div>

        <div class="card mb-4">
            <div class="card-header">
                <h2>Step 3: Enter Input</h2>
            </div>
            <div class="card-body">
                <div id="url-input" class="input-section">
                    <div class="mb-3">
                        <label for="url" class="form-label">URL</label>
                        <input type="url" class="form-control" id="url" placeholder="https://example.com">
                        <div class="form-text">Enter a valid URL to analyze its content.</div>
                    </div>
                </div>

                <div id="query-input" class="input-section d-none">
                    <div class="mb-3">
                        <label for="query" class="form-label">Search Query</label>
                        <input type="text" class="form-control" id="query" placeholder="Enter your search query">
                        <div class="form-text">We'll search for the top 3 results related to your query.</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="card mb-4">
            <div class="card-header">
                <h2>Step 4: Choose Article Length</h2>
            </div>
            <div class="card-body">
                <div class="form-check form-check-inline">
                    <input class="form-check-input" type="radio" name="article-length" id="short" value="short">
                    <label class="form-check-label" for="short">Short (~500 words)</label>
                </div>
                <div class="form-check form-check-inline">
                    <input class="form-check-input" type="radio" name="article-length" id="medium" value="medium" checked>
                    <label class="form-check-label" for="medium">Medium (~1500-2500 words)</label>
                </div>
                <div class="form-check form-check-inline">
                    <input class="form-check-input" type="radio" name="article-length" id="long" value="long">
                    <label class="form-check-label" for="long">Long (3000+ words)</label>
                </div>
            </div>
        </div>

        <div class="d-grid gap-2 mb-4">
            <button id="generate-btn" class="btn btn-primary btn-lg">Generate Content</button>
        </div>

        <div id="processing" class="text-center mb-4 d-none">
            <div class="spinner-border text-light" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-2">Processing... Please wait.</p>
        </div>

        <div id="results-section" class="card mb-4 d-none">
            <div class="card-header">
                <h2>Generated Content</h2>
            </div>
            <div class="card-body">
                <div id="result-content" class="mb-4"></div>
                <hr class="my-4">
                <h3>Continue the Conversation</h3>
                <div class="mb-3">
                    <label for="chat-input" class="form-label">Your Message</label>
                    <textarea class="form-control" id="chat-input" rows="3" placeholder="Enter your follow-up message or instructions..."></textarea>
                </div>
                <button id="send-chat" class="btn btn-primary">Send</button>
            </div>
        </div>

        <div id="error-alert" class="alert alert-danger d-none" role="alert">
            <strong>Error!</strong> <span id="error-message"></span>
        </div>
    </div>

    <footer class="footer mt-auto py-3">
        <div class="container text-center">
            <span class="text-muted">AI Content Generator</span>
        </div>
    </footer>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/js/bootstrap.bundle.min.js"></script>
    <script src="/static/js/script.js"></script>
</body>
</html>`;
}

function getCSSContent() {
  return `:root {
    --dark-bg: #121212;
    --dark-card-bg: #1e1e1e;
    --dark-input-bg: #2d2d2d;
    --dark-text: #e0e0e0;
    --dark-text-secondary: #aaaaaa;
    --primary-color: #8c52ff;
    --primary-hover: #9f6dff;
    --accent-color: #00c7b7;
    --danger-color: #ff5252;
    --success-color: #4caf50;
    --border-color: #333333;
}

.dark-mode {
    background-color: var(--dark-bg);
    color: var(--dark-text);
    min-height: 100vh;
}

.dark-mode .card {
    background-color: var(--dark-card-bg);
    border-color: var(--border-color);
}

.dark-mode .card-header {
    background-color: rgba(0, 0, 0, 0.2);
    border-bottom: 1px solid var(--border-color);
}

.dark-mode .form-control,
.dark-mode .form-select {
    background-color: var(--dark-input-bg);
    border-color: var(--border-color);
    color: var(--dark-text);
}

.dark-mode .form-control:focus,
.dark-mode .form-select:focus {
    background-color: var(--dark-input-bg);
    border-color: var(--primary-color);
    box-shadow: 0 0 0 0.25rem rgba(140, 82, 255, 0.25);
    color: var(--dark-text);
}

.dark-mode .form-text {
    color: var(--dark-text-secondary);
}

.dark-mode .form-check-input {
    background-color: var(--dark-input-bg);
    border-color: var(--border-color);
}

.dark-mode .form-check-input:checked {
    background-color: var(--primary-color);
    border-color: var(--primary-color);
}

.dark-mode .btn-primary {
    background-color: var(--primary-color);
    border-color: var(--primary-color);
}

.dark-mode .btn-primary:hover,
.dark-mode .btn-primary:focus {
    background-color: var(--primary-hover);
    border-color: var(--primary-hover);
}

.dark-mode hr {
    border-color: var(--border-color);
}

.dark-mode .text-muted {
    color: var(--dark-text-secondary) !important;
}

.dark-mode .alert-danger {
    background-color: rgba(255, 82, 82, 0.15);
    color: #ff8080;
    border-color: rgba(255, 82, 82, 0.3);
}

.dark-mode ::-webkit-scrollbar {
    width: 10px;
    height: 10px;
}

.dark-mode ::-webkit-scrollbar-track {
    background: var(--dark-bg);
}

.dark-mode ::-webkit-scrollbar-thumb {
    background: #555;
    border-radius: 5px;
}

.dark-mode ::-webkit-scrollbar-thumb:hover {
    background: #777;
}

#result-content {
    white-space: pre-wrap;
    max-height: 500px;
    overflow-y: auto;
    padding: 15px;
    background-color: rgba(0, 0, 0, 0.1);
    border-radius: 5px;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.6;
}

.spinner-border {
    width: 3rem;
    height: 3rem;
    border-width: 0.25em;
    color: var(--primary-color);
}

.footer {
    background-color: var(--dark-card-bg);
    border-top: 1px solid var(--border-color);
}

.dark-mode .card {
    transition: transform 0.2s, box-shadow 0.2s;
}

.dark-mode .card:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
}

.dark-mode .btn {
    border-radius: 5px;
    padding: 0.5rem 1.5rem;
    transition: all 0.3s;
}

.dark-mode .btn-lg {
    padding: 0.75rem 2rem;
    font-weight: 600;
    letter-spacing: 0.5px;
}

.dark-mode .form-control:focus,
.dark-mode .form-select:focus {
    box-shadow: 0 0 10px rgba(140, 82, 255, 0.5);
}

.dark-mode h1, .dark-mode h2, .dark-mode h3 {
    font-weight: 600;
}

.dark-mode h1 {
    color: var(--primary-color);
    margin-bottom: 1.5rem;
}

.dark-mode h2 {
    font-size: 1.5rem;
}

.dark-mode h3 {
    font-size: 1.25rem;
    color: var(--accent-color);
}`;
}

function getJSContent() {
  return `let sessionId = null;

document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('input[name="input-type"]').forEach(input => {
        input.addEventListener('change', function () {
            const urlInput = document.getElementById('url-input');
            const queryInput = document.getElementById('query-input');

            if (this.value === 'url') {
                urlInput.classList.remove('d-none');
                queryInput.classList.add('d-none');
            } else {
                urlInput.classList.add('d-none');
                queryInput.classList.remove('d-none');
            }
        });
    });

    const temperatureSlider = document.getElementById('temperature');
    const tempValue = document.getElementById('temp-value');
    temperatureSlider.addEventListener('input', () => tempValue.textContent = temperatureSlider.value);

    const tokenSlider = document.getElementById('max-tokens');
    const tokenValue = document.getElementById('token-value');
    tokenSlider.addEventListener('input', () => tokenValue.textContent = tokenSlider.value);

    const generateBtn = document.getElementById('generate-btn');
    generateBtn.addEventListener('click', generateContent);

    const sendChatBtn = document.getElementById('send-chat');
    sendChatBtn.addEventListener('click', continueChat);

    const chatInput = document.getElementById('chat-input');
    chatInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            continueChat();
        }
    });

    const marketInput = document.getElementById('market');
    const dataListEl = document.getElementById('market-suggestions');

    marketInput.addEventListener('input', debounce(async e => {
        const term = e.target.value.trim();
        if (term.length < 2) return;

        try {
            const res = await fetch(\`/location_suggest?q=\${encodeURIComponent(term)}\`);
            const list = await res.json();

            dataListEl.innerHTML = list
                .map(loc => \`<option value="\${loc.canonical_name}"></option>\`)
                .join('');
        } catch (err) {
            console.log('Location suggest error:', err);
        }
    }, 300));
});

function validateInputs() {
    const apiKey = document.getElementById('api-key').value.trim();
    if (!apiKey) return showError('Please enter your OpenAI API key.');

    const inputType = document.querySelector('input[name="input-type"]:checked').value;
    if (inputType === 'url') {
        const url = document.getElementById('url').value.trim();
        if (!url || !isValidUrl(url)) return showError('Please enter a valid URL.');
    } else {
        const query = document.getElementById('query').value.trim();
        if (!query) return showError('Please enter a search query.');
    }
    return true;
}

function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

function showError(message) {
    const errorAlert = document.getElementById('error-alert');
    const errorMessage = document.getElementById('error-message');
    errorMessage.textContent = message;
    errorAlert.classList.remove('d-none');
    setTimeout(() => errorAlert.classList.add('d-none'), 5000);
    return false;
}

function showProcessing(show) {
    const processingDiv = document.getElementById('processing');
    processingDiv.classList.toggle('d-none', !show);
}

async function generateContent() {
    if (!validateInputs()) return;

    const generateBtn = document.getElementById('generate-btn');
    generateBtn.disabled = true;

    document.getElementById('results-section').classList.add('d-none');
    document.getElementById('error-alert').classList.add('d-none');
    showProcessing(true);

    const requestData = {
        api_key: document.getElementById('api-key').value.trim(),
        model: document.getElementById('model').value,
        temperature: document.getElementById('temperature').value,
        max_tokens: document.getElementById('max-tokens').value,
        market: document.getElementById('market').value.trim() || "United States",
        lang: document.getElementById('lang').value.trim() || "en",
        input_type: document.querySelector('input[name="input-type"]:checked').value,
        article_length: document.querySelector('input[name="article-length"]:checked').value,
        input_content: document.querySelector('input[name="input-type"]:checked').value === 'url'
            ? document.getElementById('url').value.trim()
            : document.getElementById('query').value.trim()
    };

    try {
        const response = await fetch('/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });

        const data = await response.json();

        if (data.status === 'success' && data.text) {
            sessionId = data.session_id;
            displayResults(data.text);
        } else {
            showError(data.message || 'No content returned.');
        }
    } catch (error) {
        showError('Failed to communicate with the server: ' + error.message);
    } finally {
        showProcessing(false);
        generateBtn.disabled = false;
    }
}

function displayResults(text) {
    const resultContent = document.getElementById('result-content');
    const resultsSection = document.getElementById('results-section');
    resultContent.innerHTML = text.replace(/\\n/g, '<br>');
    resultsSection.classList.remove('d-none');
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

async function continueChat() {
    const chatInput = document.getElementById('chat-input');
    const message = chatInput.value.trim();
    if (!message) return;

    const sendChatBtn = document.getElementById('send-chat');
    sendChatBtn.disabled = true;
    showProcessing(true);

    const requestData = {
        api_key: document.getElementById('api-key').value.trim(),
        model: document.getElementById('model').value,
        market: document.getElementById('market').value.trim() || "United States",
        lang: document.getElementById('lang').value.trim() || "en",
        temperature: document.getElementById('temperature').value,
        max_tokens: document.getElementById('max-tokens').value,
        message: message,
        session_id: sessionId
    };

    try {
        const response = await fetch('/continue_chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });

        const data = await response.json();

        if (data.status === 'success') {
            const resultContent = document.getElementById('result-content');
            resultContent.innerHTML += \`
                <hr>
                <div class="user-message"><strong>You:</strong><br>\${message.replace(/\\n/g, '<br>')}</div>
                <div class="ai-message"><strong>AI:</strong><br>\${data.text.replace(/\\n/g, '<br>')}</div>
            \`;
            chatInput.value = '';
            resultContent.scrollTop = resultContent.scrollHeight;
        } else {
            showError(data.message || 'No response from the assistant.');
        }
    } catch (error) {
        showError('Failed to communicate with the server: ' + error.message);
    } finally {
        showProcessing(false);
        sendChatBtn.disabled = false;
    }
}

function debounce(fn, ms) {
    let t; 
    return (...a) => { 
        clearTimeout(t); 
        t = setTimeout(() => fn(...a), ms); 
    };
}`;
}