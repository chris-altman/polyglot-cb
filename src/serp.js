// src/serp.js
export default async function serpSearch(query, location = "United States", lang = "en") {
  const apiKey = SERPAPI_KEY; // must be bound via Wrangler secret
  const endpoint = "https://serpapi.com/search.json";
  const params = new URLSearchParams({
    engine: "google",
    q: query,
    location,
    hl: lang,
    num: 3,
    api_key: apiKey
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
