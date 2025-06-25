// src/utils.js

export function extractTextFromHTML(html) {
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<[^>]*>/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  return text.slice(0, 8000);
}

export function jsonOK(obj, corsHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
    status: 200
  });
}

export function jsonError(msg, corsHeaders = {}) {
  return new Response(JSON.stringify({ status: "error", message: msg }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
    status: 400
  });
}

export function getLocationSuggestions(query) {
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
    { canonical_name: "Rome, Italy" },
    // Add iGaming-specific locations
    { canonical_name: "New Jersey, United States" },
    { canonical_name: "Ontario, Canada" },
    { canonical_name: "Oregon, United States" },
    { canonical_name: "Pennsylvania, United States" },
    { canonical_name: "Michigan, United States" }
  ];
  
  return locations.filter(loc => 
    loc.canonical_name.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 5);
}