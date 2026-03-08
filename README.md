# Dreamweaver

**Dreamweaver** is a full-stack AI chat and image generation app built with **Node.js (Express)** and **React (Vite)**.  
It allows you to interact with AI models for chat/completions and generate high-quality images with advanced customization options.

---

## ✨ Features

- 💬 **AI Chat**: Interact with AI models for conversations and completions
- 🎨 **Image Generation**: Generate images using Pollinations AI or OpenRouter
- 📐 **Aspect Ratio Control**: Choose from 5 aspect ratios (1:1, 16:9, 9:16, 3:2, 2:3)
- 🎯 **8 Pollinations Models**: flux, zimage, flux-2-dev, imagen-4, grok-imagine, klein, klein-large, gptimage
- 🖼️ **Image Gallery**: Manage generated images with chat association/removal
- 🗑️ **Message Management**: Delete unwanted messages or failed image prompts
- 👁️ **Hover UI**: Clean interface with hover-activated controls
- 💎 **HD Quality**: Maximum quality settings with enhance mode for Pollinations

---

## 🚀 Prerequisites

- **Node.js** v18 or newer (recommended)  
- **npm** (comes with Node.js)

---

## ⚡ Quick Start

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd Dreamweaver
   ```

2. **Install dependencies**

   ```bash
   npm install
   cd client && npm install
   cd ..
   ```

3. **Configure environment variables**

   - Copy `.env.example` to `.env`:

     ```bash
     cp .env.example .env
     ```

   - Edit `.env` and add your API keys (see below for links).

4. **Start the app**

   - On Windows, you can use the provided batch file:

     ```bash
     start.bat
     ```

   - Or run manually:

     ```bash
     # Backend
     npm run dev
     
     # Frontend
     cd client && npm run dev
     ```

5. **Open the app in your browser**

   [http://localhost:5173](http://localhost:5173)

---

## 🔑 Required API Keys & Environment Variables


Set the following in your `.env` file:

| Variable | Description | Get API Key |
|----------|-------------|-------------|
| `HF_TOKEN` | HuggingFace Inference API token (for chat/completions) | [HuggingFace API](https://huggingface.co/settings/tokens) |
| `OPENROUTER_API_KEY` | OpenRouter API key (for image generation) | [OpenRouter API](https://openrouter.ai/) |
| `POLLINATIONS_API_KEY` | Pollinations API key (8 models: flux, zimage, flux-2-dev, imagen-4, grok-imagine, klein, klein-large, gptimage) | [Pollinations API](https://pollinations.ai/) |

> Other optional variables are documented in `.env.example`.

---

## 🧑‍💼 Master Account

On first run, a master account is automatically created with:

- **Username:** `master`
- **Password:** `master`

You can log in as master to see all images and chats, including deleted ones.

---

## 📁 Project Structure

```
Dreamweaver/
│
├─ src/          # Express backend (API, routes)
├─ client/       # React frontend (Vite)
├─ data/         # SQLite database
└─ generations/  # Generated images
```

---

## 🎨 Image Generation

### Aspect Ratios

Choose from 5 aspect ratios in the Images tab:
- **1:1** - Square (1024×1024)
- **16:9** - Landscape (1792×1024)
- **9:16** - Portrait (1024×1792)
- **3:2** - Photo landscape (1536×1024)
- **2:3** - Photo portrait (1024×1536)

### Pollinations Models

Select from 8 high-quality models:
- **flux** (default) - Fast, reliable generation
- **zimage** - Optimized quality
- **flux-2-dev** - Development version with experimental features
- **imagen-4** - Advanced image synthesis
- **grok-imagine** - Creative interpretation
- **klein** - Artistic generation
- **klein-large** - High-detail artistic generation
- **gptimage** - GPT-powered image creation

All images are generated with `quality=hd` and `enhance=true` for maximum quality.

---

## 🗑️ Message Management

- **Delete Messages**: Hover over any message bubble and click the trash icon in the top-right corner
- **Works for**: Regular chat messages and image generation prompts
- **Clean History**: Remove failed or unwanted prompts from your chat

---

## ⚠️ Troubleshooting

- **Missing API keys:** Ensure `.env` contains your `HF_TOKEN`, `OPENROUTER_API_KEY`, and `POLLINATIONS_API_KEY`.  
- **Port conflicts:** Change backend/frontend ports in `.env` or Vite config.
- **Token limit errors:** Image generation uses the last 4 messages for context to stay within limits.  




