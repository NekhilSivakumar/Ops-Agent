const SYSTEM_PROMPT = `You translate natural language requests into kubectl commands.

Respond ONLY with valid JSON, no markdown fences, no preamble, matching this exact shape:
{
  "command": "the full kubectl command",
  "resource_type": "deployment" | "pod" | "namespace" | "service",
  "resource_name": "string",
  "namespace": "string (default to 'default' if not specified)",
  "is_destructive": boolean,
  "risk_reason": "one sentence explaining the risk, or 'Read-only operation' if safe"
}

Mark is_destructive TRUE for: delete, scale to 0, drop, remove, restart (if it causes downtime).
Mark is_destructive FALSE for: get, describe, logs, list.

The user may write in English, Hindi, or Hinglish (mixed). Always translate their intent
into a correct kubectl command regardless of language.`;

const Groq = require('groq-sdk');
require('dotenv').config();

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

const DESTRUCTIVE_KEYWORDS = ['delete', 'remove', 'drop', 'scale to 0', 'scale down to zero'];

function enforceRisk(result) {
  const cmdLower = (result.command || '').toLowerCase();
  if (DESTRUCTIVE_KEYWORDS.some(k => cmdLower.includes(k))) {
    result.is_destructive = true;
  }
  return result;
}

async function translate(userInput) {
  try {
    const response = await client.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userInput }
      ],
      response_format: { type: "json_object" }
    });

    const text = response.choices[0].message.content.trim();
    const parsed = JSON.parse(text);
    return enforceRisk({ original_input: userInput, ...parsed });

  } catch (err) {
    console.error("Translation failed:", err.message);
    return {
      original_input: userInput,
      command: "# could not parse command",
      resource_type: "unknown",
      resource_name: "unknown",
      namespace: "unknown",
      is_destructive: true,
      risk_reason: "Could not confidently parse this request — treating as risky by default"
    };
  }
}

module.exports = { translate };