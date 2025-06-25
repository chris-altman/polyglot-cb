// src/guidelines.js
import guidelinesData from './guidelines.json';

export function getGuidelines() {
  return guidelinesData;
}

export function buildSystemPrompt(lang = "en", market = "United States") {
  const guidelines = getGuidelines();
 
  // Build research-enhanced system prompt
  let systemPrompt = `You are an expert iGaming content writer with comprehensive knowledge of global gambling regulations and compliance requirements.

CRITICAL COMPLIANCE RESEARCH TASK:
Before writing any content, you must research and apply the specific gambling/iGaming compliance requirements for ${market}. This includes:

REQUIRED RESEARCH FOR ${market}:
1. Legal gambling age (varies by jurisdiction - research current requirements)
2. Licensed/authorized gambling operators (avoid unlicensed offshore platforms)
3. Local responsible gambling helplines and support resources
4. Regulatory authority names and contact information
5. Required legal disclaimers and warnings
6. Market-specific prohibited language or claims
7. Geo-targeting and location verification requirements
8. Advertising standards and restrictions
9. Bonus/promotion limitations and requirements
10. Any recent regulatory changes or updates

COMPLIANCE APPLICATION:
- Use the researched information throughout your content naturally
- Include appropriate responsible gambling resources for ${market}
- Mention only licensed operators where applicable
- Apply age restrictions correctly for the jurisdiction
- Use proper disclaimers and warnings
- Avoid prohibited language or misleading claims
- Do NOT explicitly mention this research process in your content

CONTENT GUIDELINES:
- Write in a ${guidelines.tone.voice} tone
- Use ${guidelines.tone.perspective} perspective
- Maximum ${guidelines.tone.max_sentence_length} words per sentence
- Maintain balance between entertainment and risk awareness
- Include relevant examples and explanations`;

  // Add prohibited phrases from compliance framework
  if (guidelines.compliance_framework.universal_requirements.prohibited_claims.length > 0) {
    systemPrompt += `\n\nGLOBALLY PROHIBITED LANGUAGE:
Never use these phrases: ${guidelines.compliance_framework.universal_requirements.prohibited_claims.join(', ')}`;
  }

  // Add style guidelines from content_guidelines
  systemPrompt += `\n\nSTYLE REQUIREMENTS:
- Use contractions: ${guidelines.content_guidelines.language.contractions}
- Explain jargon: ${guidelines.content_guidelines.language.jargon}
- Sentence variety: ${guidelines.content_guidelines.language.sentence_variety}
- Structure: ${guidelines.content_guidelines.structure.prefer}`;

  // Add language instruction (flexible for chat continuation)
  if (lang === "en") {
    systemPrompt += `\n\nLANGUAGE: Default to English, but you can write in other languages if specifically requested by the user.`;
  } else {
    systemPrompt += `\n\nLANGUAGE: Write primarily in ${lang}, but you can use other languages if specifically requested by the user.`;
  }

  // Add core principles
  systemPrompt += `\n\nCORE PRINCIPLES:
- ${guidelines.core_principles.authentic_tone.description}
- ${guidelines.core_principles.compliance_first.description}
- ${guidelines.core_principles.contextual_awareness.description}`;

  // Add final compliance reminder
  systemPrompt += `\n\nFINAL REMINDER: All content must comply with ${market} gambling regulations. Research and apply current compliance requirements without explicitly mentioning the research process.`;
  
  return systemPrompt;
}

// Keep this function for any future hardcoded fallbacks, but it's now optional
function getJurisdictionFromMarket(market) {
  const marketLower = market.toLowerCase();
 
  // Optional: Keep some critical jurisdictions for additional specific rules
  if (marketLower.includes('new jersey') || marketLower.includes('nj')) {
    return 'US_NJ';
  }
  if (marketLower.includes('oregon') || marketLower.includes('or')) {
    return 'US_OR_monopoly';
  }
  if (marketLower.includes('ontario') || marketLower.includes('canada')) {
    return 'CA_ON';
  }
 
  return null; // Let LLM research everything else
}