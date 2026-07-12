const OpenAI = require("openai");
const {MAX_LLM_HISTORY, EMBEDDING_DIMENSION} = require("./constants");
const logger = require("firebase-functions/logger");

let client = null;

// gpt-5-mini: fast, capable chat tier. Tune here if you bump to gpt-5.
// Verify the exact model id in your OpenAI dashboard if a call 404s on the model.
const CHAT_MODEL = "gpt-5-mini";

// Embeddings for artwork semantic search. Output is pinned to EMBEDDING_DIMENSION
// (768) so the vectors fit the existing Pinecone index without a rebuild.
const EMBED_MODEL = "text-embedding-3-small";

// "minimal" = fastest reasoning tier — best for this short-reply chat where the
// model just follows the system prompt and calls tools (no deep reasoning needed).
// Bump to "low"/"medium" only if reply quality drops. Reasoning tokens count
// toward the completion budget, so keep generous headroom below.
const REASONING_EFFORT = "minimal";
const MAX_COMPLETION_TOKENS = 1024;

// Strict structured output — guarantees the {message, quickReplies} JSON contract
// so we no longer rely on the model voluntarily avoiding code fences.
const REPLY_SCHEMA = {
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
};

const DEFAULT_REPLY = JSON.stringify({
  message: "I'm here to help — could you tell me a little more about what you're looking for?",
  quickReplies: ["Find artwork", "Style my space", "Commission custom art"],
});

function initOpenAI(apiKey) {
  if (!client) {
    // The SDK auto-retries 429/5xx with exponential backoff; give it a few
    // tries and a bounded timeout so a transient rate-limit self-heals.
    client = new OpenAI({apiKey, maxRetries: 4, timeout: 60000});
  }
  return client;
}

async function embedText(text) {
  if (!client) throw new Error("OpenAI not initialized");
  const resp = await client.embeddings.create({
    model: EMBED_MODEL,
    input: text,
    dimensions: EMBEDDING_DIMENSION,
  });
  return resp.data[0].embedding;
}

/**
 * Recursively lowercase Gemini-style schema types ("OBJECT" → "object") so the
 * tool declarations shared with the orchestrator work as OpenAI JSON Schema.
 */
function convertSchema(node) {
  if (Array.isArray(node)) return node.map(convertSchema);
  if (!node || typeof node !== "object") return node;
  const out = {};
  for (const [key, val] of Object.entries(node)) {
    if (key === "type" && typeof val === "string") {
      out.type = val.toLowerCase();
    } else if (key === "properties" && val && typeof val === "object") {
      out.properties = {};
      for (const [propKey, propVal] of Object.entries(val)) {
        out.properties[propKey] = convertSchema(propVal);
      }
    } else if (key === "items") {
      out.items = convertSchema(val);
    } else {
      out[key] = val;
    }
  }
  return out;
}

function toOpenAITools(tools) {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: convertSchema(t.parameters),
    },
  }));
}

/**
 * Run one conversation turn with tool calling.
 * Mirrors the Gemini client's contract: side effects (artwork results,
 * commission state, intent) are owned by the caller through `onToolCall`;
 * this function only drives the OpenAI tool loop and returns the final reply.
 */
async function runChatTurn({systemPrompt, history, userMessage, tools, onToolCall}) {
  if (!client) throw new Error("OpenAI not initialized");

  const messages = [
    {role: "system", content: systemPrompt},
    ...history.slice(-MAX_LLM_HISTORY).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    })),
    {role: "user", content: userMessage},
  ];

  const openaiTools = toOpenAITools(tools);
  // Each round is one API call. OpenAI batches multiple tool calls into a single
  // response, so a typical turn needs 1 tool round + 1 final answer = 2 calls.
  // Kept low to respect tight per-minute/day request limits on lower tiers.
  const MAX_TOOL_ROUNDS = 3;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const isLastRound = round === MAX_TOOL_ROUNDS;

    const completion = await client.chat.completions.create({
      model: CHAT_MODEL,
      messages,
      tools: openaiTools,
      tool_choice: isLastRound ? "none" : "auto",
      reasoning_effort: REASONING_EFFORT,
      max_completion_tokens: MAX_COMPLETION_TOKENS,
      response_format: {type: "json_schema", json_schema: REPLY_SCHEMA},
    });

    const message = completion.choices?.[0]?.message;
    const toolCalls = message?.tool_calls || [];

    if (toolCalls.length === 0) {
      return {reply: (message?.content || "").trim() || DEFAULT_REPLY};
    }

    // Echo the assistant turn (carrying tool_calls) before appending results.
    messages.push(message);

    for (const call of toolCalls) {
      let args = {};
      try {
        args = JSON.parse(call.function?.arguments || "{}");
      } catch {
        args = {};
      }
      const name = call.function?.name;
      logger.info("Tool call", {name, args});

      let result;
      try {
        result = await onToolCall(name, args);
      } catch (err) {
        logger.error("Tool call failed", {name, error: err.message});
        result = {response: {error: err.message}};
      }
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result.response),
      });
    }
  }

  return {reply: DEFAULT_REPLY};
}

module.exports = {initOpenAI, runChatTurn, embedText};
