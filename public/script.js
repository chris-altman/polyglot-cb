let sessionId = null;

document.addEventListener('DOMContentLoaded', function () {
    // Input type toggle
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

    // Temperature slider value display
    const temperatureSlider = document.getElementById('temperature');
    const tempValue = document.getElementById('temp-value');
    temperatureSlider.addEventListener('input', () => tempValue.textContent = temperatureSlider.value);

    // Token slider value display
    const tokenSlider = document.getElementById('max-tokens');
    const tokenValue = document.getElementById('token-value');
    tokenSlider.addEventListener('input', () => tokenValue.textContent = tokenSlider.value);

    // Generate button and event
    const generateBtn = document.getElementById('generate-btn');
    generateBtn.addEventListener('click', generateContent);

    // Send chat button and event
    const sendChatBtn = document.getElementById('send-chat');
    sendChatBtn.addEventListener('click', continueChat);

    // Enter key for chat
    const chatInput = document.getElementById('chat-input');
    chatInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            continueChat();
        }
    });
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
        lang:   document.getElementById('lang').value.trim()   || "en",
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
            sessionId = data.session_id;  // 🧠 store session ID from /process
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
    resultContent.innerHTML = text.replace(/\n/g, '<br>');
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
        lang:   document.getElementById('lang').value.trim()   || "en",
        temperature: document.getElementById('temperature').value,
        max_tokens: document.getElementById('max-tokens').value,
        message: message,
        session_id: sessionId  // 🧠 attach stored session ID
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
            resultContent.innerHTML += `
                <hr>
                <div class="user-message"><strong>You:</strong><br>${message.replace(/\n/g, '<br>')}</div>
                <div class="ai-message"><strong>AI:</strong><br>${data.text.replace(/\n/g, '<br>')}</div>
            `;
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

const marketInput   = document.getElementById('market');
const dataListEl    = document.getElementById('market-suggestions');

marketInput.addEventListener('input', debounce(async e => {
  const term = e.target.value.trim();
  if (term.length < 2) return;                 // don’t spam on 1-char input

  const res  = await fetch(`/location_suggest?q=${encodeURIComponent(term)}`);
  const list = await res.json();

  dataListEl.innerHTML = list
    .map(loc => `<option value="${loc.canonical_name}"></option>`)
    .join('');
}, 300));

function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t=setTimeout(_=>fn(...a), ms); };
}

