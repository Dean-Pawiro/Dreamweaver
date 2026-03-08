import { Router } from "express";
import fs from "fs/promises";
import { requireAuth } from "./auth.js";

const router = Router();
const modelsPath = new URL("../../models.json", import.meta.url);

async function loadModels() {
  const raw = await fs.readFile(modelsPath, "utf8");
  return JSON.parse(raw);
}

// Require JWT authentication for model access
router.get("/free", requireAuth, async (req, res) => {
  try {
    const data = await loadModels();
    const models = (data?.data || []).flatMap((model) => {
      return (model.providers || [])
        .filter((provider) => {
          if (!provider.pricing) {
            return false;
          }

          const input = Number(provider.pricing.input);
          const output = Number(provider.pricing.output);
          return input === 0 && output === 0;
        })
        .map((provider) => ({
          id: model.id,
          provider: provider.provider,
          pricing: provider.pricing,
          context_length: provider.context_length ?? null
        }));
    });

    return res.json({ count: models.length, models });
  } catch (error) {
    return res.status(500).json({ error: "Failed to read models.json" });
  }
});

export default router;
