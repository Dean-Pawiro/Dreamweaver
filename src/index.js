import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import chatRouter from "./routes/chat.js";
import modelsRouter from "./routes/models.js";
import characterRouter from "./routes/character.js";
import chatsRouter from "./routes/chats.js";
import imagesRouter from "./routes/images.js";
import outfitRouter from "./routes/outfit.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imagesDir = process.env.IMAGES_DIR || path.join(__dirname, "..", "images");

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use("/images", express.static(imagesDir));
app.use("/generations", express.static(path.join(__dirname, "..", "generations")));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});


app.use("/api/chat", chatRouter);
app.use("/api/models", modelsRouter);
app.use("/api/character", characterRouter);
app.use("/api/chats", chatsRouter);
app.use("/api/images", imagesRouter);
app.use("/api/outfit", outfitRouter);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
