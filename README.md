# iGaming Content Creation Tool

A JSON configuration system for training LLMs to generate authentic, compliant, and contextually aware iGaming content.

## Overview

This tool provides guidelines for LLM-based content creation in the online gambling space, emphasizing compliance, authenticity, and conversational awareness while avoiding promotional marketing-speak.

## Key Features

- **Compliance-First Approach**: Built-in awareness of gambling regulations with uncertainty flagging
- **Authentic Tone**: Eliminates promotional "game show host" language in favor of honest, informed content
- **Contextual Awareness**: Maintains conversation thread throughout chat sessions
- **Flexible Content Scope**: Primarily iGaming-focused with natural expansion to related topics

## Core Principles

### 1. Compliance Framework
- Uses LLM knowledge base for regulatory compliance
- Flags uncertainty rather than guessing about legal requirements
- Prohibits promotion of offshore/unlicensed operators
- Includes responsible gambling messaging

### 2. Authentic Voice
- Conversational, informed tone (ages 21-65)
- Avoids hyperbolic marketing language
- Focuses on honest evaluation over promotional content
- Natural sentence flow and variety

### 3. Context Maintenance
- Remembers conversation history within each session
- Builds upon previous responses logically
- Handles topic transitions intelligently (e.g., Buffalo wings → vegan alternatives)

## Usage

The JSON configuration should be loaded into your LLM training pipeline or prompt system. The LLM will:

1. Wait for user instructions before generating content
2. Apply compliance checks using its knowledge base
3. Generate authentic, conversational content
4. Flag any regulatory uncertainties
5. Maintain context throughout the conversation

## Content Guidelines

**Preferred Style:**
- Natural, conversational tone
- Clear explanations without unnecessary jargon
- Honest assessments and reviews
- Appropriate structure for content type

**Avoid:**
- Promotional marketing language
- Hyperbolic claims ("revolutionary," "immersive," "thrilling")
- Artificial excitement or urgency
- Guaranteed outcomes or risk-free promises

## Compliance Notes

- Always verify current regulations for specific jurisdictions
- Include appropriate responsible gambling resources
- Flag uncertainty about licensing or legal status
- Default to conservative compliance interpretation

## Version History

- **v1.0** (2025-06-24): Initial streamlined configuration focusing on principles over rigid rules

---

*This tool is designed to assist with content creation while maintaining legal and ethical standards. Always verify current regulations and compliance requirements for your specific use case.*
