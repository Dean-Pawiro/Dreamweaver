import { Router } from "express";
import { requireAuth } from "./auth.js";
import multer from "multer";
import path from "path";
import fs from "fs/promises";

const router = Router();
const personasDir = path.join(process.cwd(), "images", "personas");


// Custom storage to ensure characterId is available for filename
const storage = {
  _handleFile(req, file, cb) {
    (async () => {
      await fs.mkdir(personasDir, { recursive: true });
      let id = req.body?.characterId || req.query?.characterId;
      if (!id) {
        // Try to parse from the fieldname in the form data
        file.stream.on('data', () => {}); // consume at least one chunk
        id = Date.now();
      }
      const filename = `${id}.jpg`;
      const outPath = path.join(personasDir, filename);
      const outStream = (await import('fs')).createWriteStream(outPath);
      file.stream.pipe(outStream);
      outStream.on('error', cb);
      outStream.on('finish', function () {
        cb(null, {
          path: outPath,
          filename
        });
      });
    })();
  },
  _removeFile(req, file, cb) {
    fs.unlink(file.path).then(() => cb()).catch(cb);
  }
};

const upload = multer({ storage });

// POST /api/persona-image
router.post("/", requireAuth, upload.single("portrait"), (req, res) => {
  // console.log("[persona-image upload] req.body:", req.body, "req.query:", req.query); // Debug only
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const characterId = req.body.characterId || req.query.characterId;
  const url = `/images/personas/${req.file.filename}`;
  res.json({ url, characterId });
});

export default router;
