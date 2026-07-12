/* eslint-disable no-console */
/**
 * Standalone OpenAI probe. Run from the functions/ dir:
 *   node artAdvisor/testOpenAI.js
 * Reads OPENAI_API_KEY from functions/.env (or the environment).
 * Isolates whether a failure is the model id, the params, or the schema.
 */
require("dotenv").config();
const OpenAI = require("openai");

const MODEL = process.env.PROBE_MODEL || "gpt-5-mini";

function report(label, err) {
  console.log(`\n❌ ${label} FAILED`);
  console.log("   status :", err?.status);
  console.log("   code   :", err?.code || err?.error?.code);
  console.log("   type   :", err?.type || err?.error?.type);
  console.log("   message:", err?.message);
}

async function main() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    console.error("OPENAI_API_KEY not found in functions/.env or environment.");
    process.exit(1);
  }
  const client = new OpenAI({apiKey: key});
  console.log("Probing model:", MODEL);

  // Probe 1 — bare minimum. Tests model access + basic params.
  try {
    const r = await client.chat.completions.create({
      model: MODEL,
      messages: [{role: "user", content: "Reply with the single word: ok"}],
      max_completion_tokens: 50,
    });
    console.log("\n✅ Probe 1 (minimal) OK →", JSON.stringify(r.choices?.[0]?.message?.content));
  } catch (err) {
    report("Probe 1 (minimal)", err);
    console.log("\n→ If this failed, the model id or account access is the problem; stopping.");
    return;
  }

  // Probe 2 — reasoning_effort. Tests the reasoning param.
  try {
    await client.chat.completions.create({
      model: MODEL,
      messages: [{role: "user", content: "Reply with: ok"}],
      reasoning_effort: "low",
      max_completion_tokens: 100,
    });
    console.log("✅ Probe 2 (reasoning_effort: low) OK");
  } catch (err) {
    report("Probe 2 (reasoning_effort)", err);
  }

  // Probe 3 — strict json_schema response_format. Tests structured output.
  try {
    const r = await client.chat.completions.create({
      model: MODEL,
      messages: [{role: "user", content: "Say hi to the user with two quick replies."}],
      max_completion_tokens: 200,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "advisor_reply",
          strict: true,
          schema: {
            type: "object",
            properties: {
              message: {type: "string"},
              quickReplies: {type: "array", items: {type: "string"}},
            },
            required: ["message", "quickReplies"],
            additionalProperties: false,
          },
        },
      },
    });
    console.log("✅ Probe 3 (json_schema) OK →", JSON.stringify(r.choices?.[0]?.message?.content));
  } catch (err) {
    report("Probe 3 (json_schema)", err);
  }

  // Probe 4 — everything together (mirrors runChatTurn).
  try {
    await client.chat.completions.create({
      model: MODEL,
      messages: [{role: "user", content: "Find me some art."}],
      reasoning_effort: "low",
      max_completion_tokens: 200,
      tool_choice: "auto",
      tools: [{
        type: "function",
        function: {
          name: "set_intent",
          description: "Record the user's goal.",
          parameters: {
            type: "object",
            properties: {intent: {type: "string"}},
            required: ["intent"],
          },
        },
      }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "advisor_reply",
          strict: true,
          schema: {
            type: "object",
            properties: {
              message: {type: "string"},
              quickReplies: {type: "array", items: {type: "string"}},
            },
            required: ["message", "quickReplies"],
            additionalProperties: false,
          },
        },
      },
    });
    console.log("✅ Probe 4 (tools + json_schema + reasoning) OK");
    console.log("\nAll probes passed — the params are valid for this model/account.");
  } catch (err) {
    report("Probe 4 (everything)", err);
  }
}

main().catch((e) => console.error("Unexpected:", e));
