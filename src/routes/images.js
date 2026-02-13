import { Router } from "express";
import { addImagePrompt, updateLatestImagePromptImageUrl } from "../db.js";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const router = Router();

const endpoint = "https://openrouter.ai/api/v1/chat/completions";
const timeoutMs = Number(process.env.IMAGE_TIMEOUT_MS || 120000);
const aspectRatio = process.env.OPENROUTER_IMAGE_ASPECT_RATIO || "1:1";
const imageSize = process.env.OPENROUTER_IMAGE_SIZE || "1K";
const modalities = (process.env.OPENROUTER_IMAGE_MODALITIES || "image")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

console.log(
  `[images] OpenRouter endpoint aspectRatio=${aspectRatio} imageSize=${imageSize}`
);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imagesRoot = process.env.IMAGES_DIR || path.join(__dirname, "..", "..", "images");

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
  const generationsDir = path.join(__dirname, "..", "..", "generations");
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

  return `/generations/${fileName}`;
}

router.post("/generate", async (req, res) => {
  const { prompt, chatId } = req.body || {};

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "prompt is required" });
  }

  if (!chatId || typeof chatId !== "string") {
    return res.status(400).json({ error: "chatId is required" });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OPENROUTER_API_KEY is not set" });
  }

  const model = process.env.OPENROUTER_IMAGE_MODEL;
  if (!model) {
    return res.status(500).json({ error: "OPENROUTER_IMAGE_MODEL is not set" });
  }

  console.log(`[images/generate] model=${model} prompt=${prompt.slice(0, 50)}...`);

  try {
    const data = await callOpenRouterImages({
      prompt,
      model,
      aspectRatio,
      imageSize,
      modalities,
      apiKey
    });
    const payload = extractImagePayload(data);
    const imageUrl = await saveImageToDisk({ chatId, payload });

    if (!imageUrl) {
      console.error("Missing image data in OpenRouter response. Full data:", data);
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
