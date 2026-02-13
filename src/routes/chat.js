import { Router } from "express";
import {
  addMessage,
  addImagePrompt,
  getCharacter,
  getChatHistory,
  getMemory,
  getMessageCount,
  getMessagesSlice,
  getOrCreateChat,
  getOutfit,
  getRecentMessages,
  getRecentImagePrompts,
  upsertMemory,
  upsertOutfit,
  deleteChat
} from "../db.js";

const router = Router();

const endpoint = "https://router.huggingface.co/v1/chat/completions";
const timeoutMs = Number(process.env.HF_TIMEOUT_MS || 120000);
const maxMessages = Number(process.env.MEMORY_MAX_MESSAGES || 8);
const summaryEnabled = process.env.MEMORY_SUMMARY_ENABLED !== "false";
const summaryTrigger = Number(process.env.MEMORY_SUMMARY_TRIGGER || 30);
const summaryEvery = Number(process.env.MEMORY_SUMMARY_EVERY || 10);
const summaryMaxChars = Number(process.env.MEMORY_SUMMARY_MAX_CHARS || 1200);
const summaryMaxTokens = Number(process.env.MEMORY_SUMMARY_MAX_TOKENS || 200);
const outfitEnabled = process.env.OUTFIT_ENABLED !== "false";
const outfitMaxChars = Number(process.env.OUTFIT_MAX_CHARS || 600);
const outfitMaxTokens = Number(process.env.OUTFIT_MAX_TOKENS || 120);
const outfitContextMessages = Number(process.env.OUTFIT_CONTEXT_MESSAGES || 12);
const imagePromptStyleDefault =
  "A candid, photorealistic portrait photograph of";

async function callHfChat(hfToken, hfModel, messages, maxTokens, temperature) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${hfToken}`,
      "Content-Type": "application/json"
    },
    signal: controller.signal,
    body: JSON.stringify({
      model: hfModel,
      messages,
      max_tokens: maxTokens,
      temperature
    })
  });

  clearTimeout(timeoutId);

  const rawText = await response.text();
  let data;

  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch (parseError) {
    console.error("Failed to parse Hugging Face response", parseError);
  }

  if (!response.ok) {
    const errorMessage = data?.error?.message || rawText || "Hugging Face error";
    const error = new Error(errorMessage);
    error.status = response.status;
    throw error;
  }

  return data;
}

function formatSummaryMessages(messages) {
  return messages
    .map((item) => {
      const label = item.role === "assistant" ? "Assistant" : "User";
      return `${label}: ${item.content}`;
    })
    .join("\n");
}

async function maybeUpdateSummary({ chatId, hfToken, hfModel }) {
  if (!summaryEnabled) {
    return;
  }

  if (!maxMessages || maxMessages < 1) {
    return;
  }

  const totalMessages = getMessageCount(chatId);
  if (totalMessages < summaryTrigger) {
    return;
  }

  const memory = getMemory(chatId);
  const summarizedCount = memory?.summary_message_count ?? 0;
  const targetCount = totalMessages - maxMessages;
  const newCount = targetCount - summarizedCount;

  if (newCount < summaryEvery || newCount <= 0) {
    return;
  }

  const newMessages = getMessagesSlice(chatId, summarizedCount, newCount);
  if (!newMessages.length) {
    return;
  }

  const summaryPrompt = [
    {
      role: "system",
      content:
        `Summarize the conversation for future context. Keep it under ${summaryMaxChars} characters. ` +
        "Focus on stable facts, names, relationships, goals, and preferences."
    },
    {
      role: "user",
      content:
        `Existing summary:\n${memory?.summary || "(none)"}\n\nNew messages:\n${formatSummaryMessages(newMessages)}`
    }
  ];

  try {
    const data = await callHfChat(hfToken, hfModel, summaryPrompt, summaryMaxTokens, 0.3);
    const summaryText = data?.choices?.[0]?.message?.content?.trim();

    if (summaryText) {
      upsertMemory(chatId, summaryText, targetCount);
    }
  } catch (error) {
    console.error("Summary update failed", error);
  }
}

async function maybeUpdateOutfit({ chatId, hfToken, hfModel }) {
  if (!outfitEnabled) {
    return;
  }

  const persona = getCharacter(chatId);
  const memory = getMemory(chatId);
  const currentOutfit = getOutfit(chatId);
  const recentMessages = getRecentMessages(chatId, outfitContextMessages || 12);

  const instruction =
    "Update the character's current outfit based on the conversation context. " +
    `Return ONLY the outfit description (max ${outfitMaxChars} characters). ` +
    "Focus on clothing, accessories, and footwear. " +
    "If there is no change, return exactly: UNCHANGED";

  const messages = [];
  if (persona) {
    messages.push({ role: "system", content: persona });
  }
  if (memory?.summary) {
    messages.push({ role: "system", content: `Memory summary: ${memory.summary}` });
  }
  if (currentOutfit) {
    messages.push({ role: "system", content: `Current outfit: ${currentOutfit}` });
  }
  if (recentMessages.length > 0) {
    messages.push(...recentMessages);
  }
  messages.push({ role: "system", content: instruction });

  try {
    const data = await callHfChat(hfToken, hfModel, messages, outfitMaxTokens, 0.2);
    const result = data?.choices?.[0]?.message?.content?.trim();

    if (!result || result.toUpperCase() === "UNCHANGED") {
      return;
    }

    const normalized = result.length > outfitMaxChars ? result.slice(0, outfitMaxChars) : result;
    upsertOutfit(chatId, normalized);
  } catch (error) {
    console.error("Outfit update failed", error);
  }
}

router.post("/", async (req, res) => {
  const { message, model, chatId } = req.body || {};

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message is required" });
  }

  const hfToken = process.env.HF_TOKEN;
  if (!hfToken) {
    return res.status(500).json({ error: "HF_TOKEN is not set" });
  }

  const hfModel = model || process.env.HF_MODEL || "Sao10K/L3-8B-Stheno-v3.2";
  const resolvedChatId = getOrCreateChat(chatId);

  addMessage(resolvedChatId, "user", message);

  const persona = getCharacter(resolvedChatId);
  const memory = getMemory(resolvedChatId);
  const outfit = getOutfit(resolvedChatId);
  const recentMessages = getRecentMessages(resolvedChatId, maxMessages || 8);

  const messages = [];
  if (persona) {
    messages.push({ role: "system", content: persona });
  }
  if (memory?.summary) {
    messages.push({ role: "system", content: `Memory summary: ${memory.summary}` });
  }
  if (outfit) {
    messages.push({ role: "system", content: `Current outfit: ${outfit}` });
  }
  messages.push(...recentMessages);

  try {
    const data = await callHfChat(hfToken, hfModel, messages, 1024, 0.7);
    const text = data?.choices?.[0]?.message?.content;

    if (!text) {
      console.error("Missing content in HF response. Full data:", data);
      return res.status(502).json({ error: "Unexpected Hugging Face response" });
    }

    addMessage(resolvedChatId, "assistant", text);

    setImmediate(() => {
      maybeUpdateSummary({ chatId: resolvedChatId, hfToken, hfModel }).catch((error) => {
        console.error("Summary update failed", error);
      });
      maybeUpdateOutfit({ chatId: resolvedChatId, hfToken, hfModel }).catch((error) => {
        console.error("Outfit update failed", error);
      });
    });

    return res.json({ reply: text, model: hfModel, chatId: resolvedChatId });
  } catch (error) {
    if (error?.name === "AbortError") {
      return res.status(504).json({ error: "Upstream timeout" });
    }
    if (error?.status) {
      return res.status(error.status).json({ error: error.message || "Hugging Face error" });
    }
    console.error("Chat request failed", error);
    return res.status(500).json({ error: error?.message || "Request failed" });
  }
});

router.post("/image-prompt", async (req, res) => {
  const { chatId, model, style } = req.body || {};

  const hfToken = process.env.HF_TOKEN;
  if (!hfToken) {
    return res.status(500).json({ error: "HF_TOKEN is not set" });
  }

  const hfModel = model || process.env.HF_MODEL || "Sao10K/L3-8B-Stheno-v3.2";
  const resolvedChatId = getOrCreateChat(chatId);

  const persona = getCharacter(resolvedChatId);
  const memory = getMemory(resolvedChatId);
  const recentMessages = getRecentMessages(resolvedChatId, maxMessages || 8);
  const recentPrompts = getRecentImagePrompts(resolvedChatId, 3);

  const imageStyle = typeof style === "string" && style.trim() ? style.trim() : imagePromptStyleDefault;
  let instruction =
    "Create a single, concise image prompt for a realistic photo. " +
    "Include physical characteristics, setting, pose, clothing, mood, and a specific activity or situation. " +
    "Be concrete about the environment, body language, and what is happening in the scene. " +
    "Return only the prompt text. Begin with: " +
    imageStyle +
    ". End with: shot on professional camera, 85mm lens, shallow depth of field, sharp realistic eyes with natural catchlights, detailed skin, natural indoor lighting, raw photography style.";

  if (recentMessages.length > 0) {
    const chatSnippet = recentMessages
      .map((msg) => `${msg.role === "user" ? "You" : "Assistant"}: ${msg.content}`)
      .join("\n");
    instruction += "\n\nRecent conversation context:\n" + chatSnippet;
  }

  if (recentPrompts.length > 0) {
    instruction += "\n\nPrevious image variations for this character:\n" +
      recentPrompts.map((p, i) => `${i + 1}. ${p}`).join("\n") +
      "\n\nCreate a NEW and DIFFERENT variation: explore different poses, clothing, settings, activities, or emotions based on the conversation context. Make it visually distinct from the previous prompts.";
  } else {
    instruction += "\n\nCreate the first image prompt based on the conversation context.";
  }

  const messages = [];
  if (persona) {
    messages.push({ role: "system", content: persona });
  }
  if (memory?.summary) {
    messages.push({ role: "system", content: `Memory summary: ${memory.summary}` });
  }
  messages.push(...recentMessages);
  messages.push({ role: "system", content: instruction });

  try {
    const data = await callHfChat(hfToken, hfModel, messages, 320, 0.6);
    const prompt = data?.choices?.[0]?.message?.content?.trim();

    if (!prompt) {
      console.error("Missing content in HF response. Full data:", data);
      return res.status(502).json({ error: "Unexpected Hugging Face response" });
    }

    addImagePrompt(resolvedChatId, prompt);

    return res.json({ prompt, model: hfModel, chatId: resolvedChatId });
  } catch (error) {
    if (error?.name === "AbortError") {
      return res.status(504).json({ error: "Upstream timeout" });
    }
    if (error?.status) {
      return res.status(error.status).json({ error: error.message || "Hugging Face error" });
    }
    console.error("Image prompt request failed", error);
    return res.status(500).json({ error: error?.message || "Request failed" });
  }
});

router.get("/history", (req, res) => {
  const { chatId, limit, offset } = req.query || {};

  if (!chatId || typeof chatId !== "string") {
    return res.status(400).json({ error: "chatId is required" });
  }

  const safeLimit = Math.min(Number(limit) || 100, 500);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const messages = getChatHistory(chatId, safeLimit, safeOffset);
  return res.json({ chatId, messages, limit: safeLimit, offset: safeOffset });
});

router.post("/delete", (req, res) => {
  const { chatId } = req.query || req.body || {};
  if (!chatId || typeof chatId !== "string") {
    return res.status(400).json({ error: "chatId is required" });
  }
  try {
    deleteChat(chatId);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to delete chat" });
  }
});

export default router;
