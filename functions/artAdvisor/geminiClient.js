const {GoogleGenerativeAI} = require("@google/generative-ai");
const {GEMINI_CHAT_MODEL, GEMINI_EMBED_MODEL, MAX_LLM_HISTORY} = require("./constants");
const logger = require("firebase-functions/logger");

let genai = null;

function initGemini(apiKey) {
  if (!genai) {
    genai = new GoogleGenerativeAI(apiKey);
  }
  return genai;
}

async function embedText(text) {
  if (!genai) throw new Error("Gemini not initialized");
  const model = genai.getGenerativeModel({model: GEMINI_EMBED_MODEL});
  const result = await model.embedContent(text);
  return result.embedding.values;
}

/**
 * Run one conversation turn with tool calling.
 * Side effects (artwork results, commission state, intent) are owned by the
 * caller through its `onToolCall` closure — this function only manages the
 * Gemini tool loop and returns the final text reply.
 */
async function runChatTurn({systemPrompt, history, userMessage, tools, onToolCall}) {
  if (!genai) throw new Error("Gemini not initialized");

  const model = genai.getGenerativeModel({
    model: GEMINI_CHAT_MODEL,
    systemInstruction: {parts: [{text: systemPrompt}]},
    tools: [{functionDeclarations: tools}],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    },
  });

  const chatHistory = history.slice(-MAX_LLM_HISTORY).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{text: m.content}],
  }));

  const chat = model.startChat({history: chatHistory});
  const MAX_TOOL_ROUNDS = 6;

  let response = await chat.sendMessage(userMessage);
  let candidate = response.response.candidates?.[0];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const fnCalls = candidate?.content?.parts?.filter((p) => p.functionCall) || [];
    if (fnCalls.length === 0) break;

    const toolResponses = [];
    for (const part of fnCalls) {
      const {name, args} = part.functionCall;
      logger.info("Tool call", {name, args});

      try {
        const result = await onToolCall(name, args || {});
        toolResponses.push({
          functionResponse: {name, response: result.response},
        });
      } catch (err) {
        logger.error("Tool call failed", {name, error: err.message});
        toolResponses.push({
          functionResponse: {name, response: {error: err.message}},
        });
      }
    }

    response = await chat.sendMessage(toolResponses);
    candidate = response.response.candidates?.[0];
  }

  const textParts = candidate?.content?.parts?.filter((p) => p.text) || [];
  const reply = textParts.map((p) => p.text).join("\n").trim() ||
    JSON.stringify({
      message: "I'm here to help — could you tell me a little more about what you're looking for?",
      quickReplies: ["Find artwork", "Style my space", "Commission custom art"],
    });

  return {reply};
}

module.exports = {initGemini, embedText, runChatTurn};
