const Groq = require('groq-sdk');
require('dotenv').config();

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You translate natural language requests into CLI commands
across two tool types: kubectl and git.

Respond ONLY with valid JSON, no markdown fences, no preamble, matching this exact shape:
{
  "tool": "kubectl" | "git",
  "command": "the full command",
  "resource_type": "string (e.g. deployment, pod, branch, commit)",
  "resource_name": "string (e.g. auth-service, main, feature-x)",
  "namespace": "string (kubectl only; empty string for git)",
  "is_destructive": boolean,
  "risk_reason": "one sentence explaining the risk, or 'Read-only operation' if safe"
}

Destructive for kubectl: delete, scale to 0, drop namespace, scale down to zero.
Safe for kubectl: get, describe, logs, list.

Destructive for git: push --force, push -f, reset --hard, branch -D, clean -fd, rebase (when rewriting shared history).
Safe for git: status, log, diff, branch (listing), fetch, show.

For git commands, put the branch or commit name in resource_name, and leave namespace as an empty string.

The user may write in English, Hindi, or Hinglish (mixed). Always translate their intent
into a correct command regardless of language.`;

const KUBECTL_DESTRUCTIVE_KEYWORDS = ['delete', 'remove', 'drop', 'scale to 0', 'scale down to zero'];
const GIT_DESTRUCTIVE_KEYWORDS = ['push --force', 'push -f', 'reset --hard', 'branch -d', 'clean -fd'];

function enforceRisk(result) {
  const cmdLower = (result.command || '').toLowerCase();
  const keywords = result.tool === 'git' ? GIT_DESTRUCTIVE_KEYWORDS : KUBECTL_DESTRUCTIVE_KEYWORDS;
  if (keywords.some(k => cmdLower.includes(k))) {
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
      tool: "unknown",
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