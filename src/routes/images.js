import { Router } from "express";
import { getDb, addImagePrompt, updateLatestImagePromptImageUrl, getOrCreateChat } from "../db.js";
import { requireAuth } from "./auth.js";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const router = Router();
const pollinationsModelAllowlist = new Set([
  "flux",
  "zimage",
  "flux-2-dev",
  "imagen-4",
  "grok-imagine",
  "klein",
  "klein-large",
  "gptimage"
]);

function resolvePollinationsModel(model) {
  if (typeof model !== "string") {
    return "flux";
  }
  const trimmed = model.trim().toLowerCase();
  return pollinationsModelAllowlist.has(trimmed) ? trimmed : "flux";
}

// Pollinations balance endpoint (backend proxy)
router.get("/pollinations/balance", async (req, res) => {
  try {
    const apiKey = process.env.POLLINATIONS_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "POLLINATIONS_API_KEY is not set" });
    const response = await fetch("https://enter.pollinations.ai/api/account/balance", {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Request failed" });
  }
});
// Remove chat_id from image_prompts for a given image_url
router.post("/gallery/image/remove-chat", requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const user_id = req.user.user_id;
    const { imageUrl } = req.body || {};
    if (!imageUrl) return res.status(400).json({ error: "imageUrl required" });
    // Only allow user to remove chat_id from their own images
    const row = db.prepare("SELECT chat_id FROM image_prompts WHERE image_url = ?").get(imageUrl);
    if (!row) return res.status(404).json({ error: "Image not found" });
    // Check ownership
    let chat = null;
    if (row.chat_id && row.chat_id !== "deleted") {
      chat = db.prepare("SELECT user_id FROM chats WHERE id = ?").get(row.chat_id);
      if (!chat || chat.user_id !== user_id) return res.status(403).json({ error: "Forbidden" });
      // Ensure a valid 'deleted' chat exists
      let deletedChat = db.prepare("SELECT id FROM chats WHERE id = ?").get("deleted");
      if (!deletedChat) {
        db.prepare("INSERT INTO chats (id, user_id) VALUES (?, ?)" ).run("deleted", user_id);
      }
      db.prepare("UPDATE image_prompts SET chat_id = ? WHERE image_url = ?").run("deleted", imageUrl);
    } else {
      // Already deleted or no valid chat, just return success
      return res.json({ success: true });
    }
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Request failed" });
  }
});
// Gallery-only image generation: send prompt directly to Pollinations
router.post("/gallery/generate", requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const user_id = req.user.user_id;
    const { prompt, pollinationsModel, aspectRatio } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "prompt is required" });
    }
    // Use special gallery chat
    const galleryChatId = `gallery_${user_id}`;
    // Ensure hidden gallery chat exists
    getOrCreateChat(galleryChatId, user_id);
    const apiKey = process.env.POLLINATIONS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "POLLINATIONS_API_KEY is not set" });
    }
    const resolvedModel = resolvePollinationsModel(pollinationsModel);
    // Send prompt directly to Pollinations
    const payload = await callPollinationsImages({ prompt, apiKey, model: resolvedModel, aspectRatio });
    const imageUrl = await saveImageToDisk({ chatId: galleryChatId, payload });
    if (!imageUrl) {
      return res.status(502).json({ error: "Unexpected image response" });
    }
    // Save prompt and image
    addImagePrompt(galleryChatId, prompt, imageUrl);
    return res.json({ imageUrl, model: resolvedModel, chatId: galleryChatId });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Request failed" });
  }
});
// ...existing code...

// Gallery endpoint: returns images from generations directory
router.get("/gallery", requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const user_id = req.user.user_id;

    // Get master user id
    const masterUser = db.prepare("SELECT user_id FROM users WHERE username = ?").get("master");
    let rows;
    if (masterUser && user_id === masterUser.user_id) {
      // Master sees all images, including those without a chat_id
      rows = db.prepare(`
        SELECT ip.chat_id, ip.image_url FROM image_prompts ip
        WHERE ip.image_url IS NOT NULL
        ORDER BY ip.id DESC LIMIT 100
      `).all();
    } else {
      // Only images from chats owned by this user (must have a chat_id and not deleted)
      rows = db.prepare(`
        SELECT ip.chat_id, ip.image_url FROM image_prompts ip
        JOIN chats c ON ip.chat_id = c.id
        WHERE ip.image_url IS NOT NULL AND c.user_id = ? AND ip.chat_id != 'deleted'
        ORDER BY ip.id DESC LIMIT 100
      `).all(user_id);
    }
    // Only include images that exist on disk
    const generationsDir = path.join(__dirname, "..", "..", "images", "generations");
    const files = await fs.readdir(generationsDir);
    const fileSet = new Set(files);
    const images = rows
      .filter(row => {
        const fname = row.image_url.split("/").pop();
        return fileSet.has(fname);
      })
      .map(row => ({ url: row.image_url, chatId: row.chat_id }));
    return res.json({ images });
  } catch (e) {
    return res.status(500).json({ error: "Failed to load gallery" });
  }
});

const endpoint = "https://openrouter.ai/api/v1/chat/completions";
const timeoutMs = Number(process.env.IMAGE_TIMEOUT_MS || 120000);
const aspectRatio = process.env.OPENROUTER_IMAGE_ASPECT_RATIO || "1:1";
const imageSize = process.env.OPENROUTER_IMAGE_SIZE || "1K";
const modalities = (process.env.OPENROUTER_IMAGE_MODALITIES || "image")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imagesRoot = process.env.IMAGES_DIR || path.join(__dirname, "..", "..", "images");

// Add Pollinations API key to env
// Pollinations API key should be set in .env

async function callOpenRouterImages({ prompt, model, aspectRatio, imageSize, modalities, apiKey }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  };

  if (process.env.OPENROUTER_REFERER) {
    headers["HTTP-Referer"] = process.env.OPENROUTER_REFERER;
  }
  if (process.env.OPENROUTER_APP_TITLE) {
    headers["X-Title"] = process.env.OPENROUTER_APP_TITLE;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    signal: controller.signal,
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      modalities: modalities.length ? modalities : ["image"],
      image_config: {
        aspect_ratio: aspectRatio,
        image_size: imageSize
      },
      stream: false
    })
  });

  clearTimeout(timeoutId);

  const rawText = await response.text();
  let data;

  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch (parseError) {
    console.error("Failed to parse OpenRouter image response", parseError);
  }

  if (!response.ok) {
    const errorMessage = data?.error?.message || rawText || "OpenRouter image generation error";
    const error = new Error(errorMessage);
    error.status = response.status;
    throw error;
  }

  return data;
}

async function callPollinationsImages({ prompt, apiKey, model = "flux", aspectRatio = "1:1" }) {
  const resolvedModel = resolvePollinationsModel(model);
  
  // Convert aspect ratio to width/height (max dimension: 1024)
  const baseSize = 1024;
  let width = baseSize;
  let height = baseSize;
  
  const ratioMap = {
    "1:1": { w: 1, h: 1 },
    "16:9": { w: 16, h: 9 },
    "9:16": { w: 9, h: 16 },
    "3:2": { w: 3, h: 2 },
    "2:3": { w: 2, h: 3 }
  };
  
  const ratio = ratioMap[aspectRatio] || ratioMap["1:1"];
  const aspectValue = ratio.w / ratio.h;
  
  if (aspectValue > 1) {
    // landscape
    width = Math.round(baseSize * aspectValue);
  } else {
    // portrait
    height = Math.round(baseSize / aspectValue);
  }
  
  const url = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?model=${encodeURIComponent(resolvedModel)}&width=${width}&height=${height}&quality=hd&enhance=true`;
  const headers = {
    Authorization: `Bearer ${apiKey}`
  };
  const response = await fetch(url, { method: "GET", headers });
  if (!response.ok) {
    throw new Error(`Pollinations image generation error: ${await response.text()}`);
  }
  // Get the image as base64
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString("base64");
  return { url: null, base64 };
}

function extractImagePayload(data) {
  const imageUrl =
    data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ||
    data?.choices?.[0]?.message?.images?.[0]?.imageUrl?.url ||
    data?.choices?.[0]?.message?.images?.[0]?.url ||
    null;
  return { url: imageUrl, base64: null };
}

function sanitizeChatId(chatId) {
  const safe = chatId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return safe || "chat";
}

function extensionFromContentType(contentType) {
  const safeType = (contentType || "").toLowerCase();
  if (safeType.includes("image/jpeg")) {
    return "jpg";
  }
  if (safeType.includes("image/webp")) {
    return "webp";
  }
  if (safeType.includes("image/png")) {
    return "png";
  }
  return "png";
}

function decodeDataUrl(dataUrl) {
  const match = /^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/i.exec(dataUrl || "");
  if (!match) {
    return null;
  }

  const contentType = match[1].toLowerCase();
  const base64 = match[3];
  return {
    buffer: Buffer.from(base64, "base64"),
    extension: extensionFromContentType(contentType)
  };
}

async function saveImageToDisk({ chatId, payload }) {
  const generationsDir = path.join(__dirname, "..", "..", "images", "generations");
  await fs.mkdir(generationsDir, { recursive: true });

  let buffer = null;
  let extension = "png";

  if (payload.base64) {
    buffer = Buffer.from(payload.base64, "base64");
  } else if (payload.url) {
    const decoded = decodeDataUrl(payload.url);
    if (decoded) {
      buffer = decoded.buffer;
      extension = decoded.extension;
    } else {
      const imageResponse = await fetch(payload.url);
      if (!imageResponse.ok) {
        throw new Error(`Failed to download image: ${imageResponse.status}`);
      }
      const contentType = imageResponse.headers.get("content-type");
      extension = extensionFromContentType(contentType);
      buffer = Buffer.from(await imageResponse.arrayBuffer());
    }
  }

  if (!buffer) {
    return null;
  }

  const fileName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
  const filePath = path.join(generationsDir, fileName);
  await fs.writeFile(filePath, buffer);

  return `/images/generations/${fileName}`;
}

router.post("/generate", async (req, res) => {
  const { prompt, chatId, imageApi, pollinationsModel, aspectRatio } = req.body || {};
  const count = Number(req.query.count) || 1;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "prompt is required" });
  }
  if (!chatId || typeof chatId !== "string") {
    return res.status(400).json({ error: "chatId is required" });
  }

  let imageUrl = null;
  try {
    if (imageApi === "pollinations") {
      const apiKey = process.env.POLLINATIONS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "POLLINATIONS_API_KEY is not set" });
      }
      const resolvedModel = resolvePollinationsModel(pollinationsModel);
      const payload = await callPollinationsImages({ prompt, apiKey, model: resolvedModel, aspectRatio });
      imageUrl = await saveImageToDisk({ chatId, payload });
      if (!imageUrl) {
        return res.status(502).json({ error: "Unexpected image response" });
      }
      const updated = updateLatestImagePromptImageUrl(chatId, imageUrl);
      if (!updated) {
        addImagePrompt(chatId, prompt, imageUrl);
      }
      return res.json({ imageUrl, model: resolvedModel });
    }
    // OpenRouter image generation
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "OPENROUTER_API_KEY is not set" });
    }
    const model = process.env.OPENROUTER_IMAGE_MODEL || "openrouter/image";
    const selectedAspectRatio = aspectRatio || process.env.OPENROUTER_IMAGE_ASPECT_RATIO || "1:1";
    const payload = await callOpenRouterImages({
      prompt,
      model,
      aspectRatio: selectedAspectRatio,
      imageSize,
      modalities,
      apiKey
    });
    const imagePayload = extractImagePayload(payload);
    imageUrl = await saveImageToDisk({ chatId, payload: imagePayload });
    if (!imageUrl) {
      return res.status(502).json({ error: "Unexpected image response" });
    }
    const updated = updateLatestImagePromptImageUrl(chatId, imageUrl);
    if (!updated) {
      addImagePrompt(chatId, prompt, imageUrl);
    }
    return res.json({ imageUrl, model });
  } catch (error) {
    if (error?.name === "AbortError") {
      return res.status(504).json({ error: "Upstream timeout" });
    }
    if (error?.status) {
      return res.status(error.status).json({ error: error.message || "Image generation error" });
    }
    console.error("Image generation failed", error);
    return res.status(500).json({ error: error?.message || "Request failed" });
  }
});

export default router;
