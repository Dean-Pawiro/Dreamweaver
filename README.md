# Dreamweaver

**Dreamweaver** is a full-stack AI chat and image generation app built with **Node.js (Express)** and **React (Vite)**.  
It allows you to interact with AI models for chat/completions and generate images seamlessly.

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

> Other optional variables are documented in `.env.example`.

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

## ⚠️ Troubleshooting

- **Missing API keys:** Ensure `.env` contains your `HF_TOKEN` and `OPENROUTER_API_KEY`.  
- **Port conflicts:** Change backend/frontend ports in `.env` or Vite config.  




