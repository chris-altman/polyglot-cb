// src/guidelines.js
import guidelinesData from './guidelines.json';

export function getGuidelines() {
  return guidelinesData;
}

export function buildSystemPrompt(lang = "en", market = "United States") {
  const guidelines = getGuidelines();
  
  // Get jurisdiction-specific rules if available
  const jurisdiction = getJurisdictionFromMarket(market);
  const jurisdictionRules = jurisdiction ? guidelines.jurisdictions[jurisdiction] : null;
  
  // Build the system prompt
  let systemPrompt = guidelines.system_prompt;
  
  // Add global defaults
  const globalDefaults = guidelines.global_defaults;
  systemPrompt += `\n\nGLOBAL REQUIREMENTS:`;
  systemPrompt += `\n- Target age: ${globalDefaults.age_minimum}+`;
  systemPrompt += `\n- Tone: ${globalDefaults.tone.voice}, ${globalDefaults.tone.perspective}`;
  systemPrompt += `\n- Style: ${globalDefaults.tone.formality}, max ${globalDefaults.tone.max_sentence_length} words per sentence`;
  systemPrompt += `\n- Always include: "${globalDefaults.mandatory_rg_line}"`;
  
  // Add banned phrases
  if (globalDefaults.banned_phrases.length > 0) {
    systemPrompt += `\n- NEVER use these phrases: ${globalDefaults.banned_phrases.join(', ')}`;
  }
  
  // Add jurisdiction-specific rules
  if (jurisdictionRules) {
    systemPrompt += `\n\nJURISDICTION-SPECIFIC RULES (${jurisdiction}):`;
    systemPrompt += `\n- Regulator: ${jurisdictionRules.regulator}`;
    systemPrompt += `\n- Age minimum: ${jurisdictionRules.age_minimum}`;
    systemPrompt += `\n- Helpline: ${jurisdictionRules.helpline}`;
    systemPrompt += `\n- Legal betting: ${jurisdictionRules.compliance.legal_betting_methods.join(', ')}`;
    
    if (jurisdictionRules.extra_requirements.length > 0) {
      systemPrompt += `\n- Include: ${jurisdictionRules.extra_requirements.join(', ')}`;
    }
    
    if (jurisdictionRules.monopoly) {
      systemPrompt += `\n- MONOPOLY MARKET: Only mention ${jurisdictionRules.operator}`;
    }
  }
  
  // Language instruction
  systemPrompt += `\n\nLANGUAGE: Write EVERYTHING in ${lang}. Every word must be in ${lang}.`;
  
  return systemPrompt;
}

function getJurisdictionFromMarket(market) {
  const marketLower = market.toLowerCase();
  
  // Map markets to jurisdiction codes
  if (marketLower.includes('new jersey') || marketLower.includes('nj')) {
    return 'US_NJ';
  }
  if (marketLower.includes('oregon') || marketLower.includes('or')) {
    return 'US_OR_monopoly';
  }
  if (marketLower.includes('ontario') || marketLower.includes('canada')) {
    return 'CA_ON';
  }
  
  return null; // No specific jurisdiction rules
}