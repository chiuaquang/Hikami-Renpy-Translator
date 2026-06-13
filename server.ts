import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Lazy init GoogleGenAI
let ai: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined. Please add key in Secrets or Settings.");
    }
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return ai;
}

// 1. Endpoint: translates using Gemini (free/highly optimized)
app.post("/api/translate-gemini", async (req, res) => {
  try {
    const { texts, targetLang, model } = req.body;
    if (!texts || !Array.isArray(texts)) {
      return res.status(400).json({ error: "Missing or invalid texts array." });
    }
    if (!targetLang) {
      return res.status(400).json({ error: "Missing targetLang." });
    }

    const client = getGeminiClient();
    const selectedModel = model || "gemini-3.5-flash";

    const systemInstruction = 
      "You are a professional Visual Novel localization expert and translator. Your task is to translate a batch of consecutive dialogues from a Ren'Py game file into natural, emotional, and context-appropriate target language prose, keeping character xưng-hô (pronouns/relationship words) natural and consistent based on the surrounding conversation flow.\n\n" +
      "Rules:\n" +
      "1. Translate directly and elegantly. Avoid word-for-word translation. Keep the original vibe, emotion, and flavor.\n" +
      "2. For NSFW/adult (R-18) content: Translate directly and explicitly. Do not censor, modify, or soften explicit or crude words.\n" +
      "3. CRITICAL RULE: NEVER translate or alter placeholder tags such as ⟦RENPH{0}⟧, ⟦RENPH{1}⟧, etc. Keep them exactly identical in the translated output.\n" +
      "4. Preserve all Ren'Py tags, special characters, and formatting patterns.\n" +
      "5. Return the exact same number of translated lines inside a flat JSON array of strings in the exact same order.";

    const promptText = 
      `Translate the following array of sequential dialog texts into ${targetLang}.\n` +
      `Ensure consistent and natural pronouns/xưng hô across the conversation sequence.\n` +
      `Output must be a plain JSON array of translated strings with exactly ${texts.length} elements.\n\n` +
      `Input JSON array:\n` +
      JSON.stringify(texts, null, 2);

    const geminiRes = await client.models.generateContent({
      model: selectedModel,
      contents: promptText,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.3,
      }
    });

    const outputText = geminiRes.text;
    if (!outputText) {
      return res.status(500).json({ error: "Gemini returned empty response." });
    }

    try {
      const parsedArray = JSON.parse(outputText);
      if (Array.isArray(parsedArray)) {
        res.json({ translations: parsedArray });
      } else {
        res.status(500).json({ error: "Gemini did not return a valid array of strings.", raw: outputText });
      }
    } catch (parseError) {
      // Try to extract JSON array using regex if formatting has extra markdown
      const match = outputText.match(/\[\s*[\s\S]*\s*\]/);
      if (match) {
        try {
          const parsedArray = JSON.parse(match[0]);
          if (Array.isArray(parsedArray)) {
            return res.json({ translations: parsedArray });
          }
        } catch (_) {}
      }
      res.status(500).json({ error: "Failed to parse Gemini output as JSON array.", raw: outputText });
    }
  } catch (error: any) {
    console.error("Gemini Translation Error:", error);
    res.status(500).json({ error: error.message || String(error) });
  }
});

// 2. Endpoint: DeepSeek Proxy
app.post("/api/deepseek-proxy", async (req, res) => {
  try {
    const { apiKey, model, messages, stream } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: "Missing DeepSeek API key" });
    }

    const body = {
      model: model || "deepseek-chat",
      messages: messages || [],
      stream: !!stream
    };

    const dsRes = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const text = await dsRes.text();
    if (!dsRes.ok) {
      return res.status(dsRes.status).send(text);
    }
    res.status(200).setHeader("Content-Type", "application/json").send(text);
  } catch (err: any) {
    console.error("DeepSeek proxy error:", err);
    res.status(500).json({ error: "Proxy to DeepSeek failed", details: err.message || String(err) });
  }
});

// 3. Endpoint: DeepL Proxy
app.post("/api/deepl-trans", async (req, res) => {
  try {
    const { apiKey, text, target_lang, ...rest } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: "Missing DeepL API Key" });
    }

    const isFreeKey = String(apiKey).trim().endsWith(":fx");
    const baseUrl = isFreeKey ? "https://api-free.deepl.com" : "https://api.deepl.com";

    const body = {
      text: text,
      target_lang: target_lang,
      ...rest
    };

    const dlRes = await fetch(`${baseUrl}/v2/translate`, {
      method: "POST",
      headers: {
        "Authorization": `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const responseText = await dlRes.text();
    if (!dlRes.ok) {
      return res.status(dlRes.status).send(responseText);
    }
    res.status(200).setHeader("Content-Type", "application/json").send(responseText);
  } catch (err: any) {
    console.error("DeepL Proxy Error:", err);
    res.status(500).json({ error: "DeepL proxy failed", details: err.message || String(err) });
  }
});

// Endpoint: Gemini Proxy (forces server-side execution to avoid CORS errors for user key)
app.post("/api/gemini-proxy", async (req, res) => {
  try {
    const { apiKey, model, messages } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: "Missing Gemini API key" });
    }

    let targetModel = model || "gemini-2.5-flash";
    if (targetModel === "gemini-3.5-flash") {
      targetModel = "gemini-2.5-flash";
    } else if (targetModel === "gemini-3.5-pro") {
      targetModel = "gemini-2.5-pro";
    }

    const body = {
      model: targetModel,
      messages: messages || [],
    };

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    if (!response.ok) {
      return res.status(response.status).send(text);
    }
    res.status(200).setHeader("Content-Type", "application/json").send(text);
  } catch (err: any) {
    console.error("Gemini Proxy Error:", err);
    res.status(500).json({ error: "Proxy to Gemini failed", details: err.message || String(err) });
  }
});

// Endpoint: OpenAI Proxy
app.post("/api/openai-proxy", async (req, res) => {
  try {
    const { apiKey, model, messages } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: "Missing OpenAI API key" });
    }

    const body = {
      model: model || "gpt-4o-mini",
      messages: messages || [],
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    if (!response.ok) {
      return res.status(response.status).send(text);
    }
    res.status(200).setHeader("Content-Type", "application/json").send(text);
  } catch (err: any) {
    console.error("OpenAI Proxy Error:", err);
    res.status(500).json({ error: "Proxy to OpenAI failed", details: err.message || String(err) });
  }
});

// 4. Endpoint: Lingva Free Proxy
app.post("/api/lingva-proxy", async (req, res) => {
  const BASES = [
    "https://lingva.lunar.icu",
    "https://lingva.dialectapp.org",
    "https://lingva.ml",
    "https://lingva.vercel.app",
    "https://translate.plausibility.cloud",
    "https://lingva.garudalinux.org",
  ];

  try {
    const { source, target, text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Missing text to translate." });
    }

    let lastErr = null;
    for (const base of BASES) {
      try {
        const url = `${base.replace(/\/$/, "")}/api/v1/${encodeURIComponent(source || "auto")}/${encodeURIComponent(target || "en")}/${encodeURIComponent(text)}`;
        const r = await fetch(url, { method: "GET", signal: AbortSignal.timeout(15000) });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (data && typeof data.translation === "string") {
          return res.json({ translation: data.translation, base });
        }
      } catch (e) {
        lastErr = e;
      }
    }
    res.status(502).json({ error: "Lingva free engines are currently unresponsive.", details: String(lastErr) });
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// 5. Endpoint: Google Translate Free Proxy
app.post("/api/google-proxy", async (req, res) => {
  try {
    const { text, source, target } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Missing text." });
    }
    const sl = source || "auto";
    const tl = target || "en";
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(text)}`;

    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });

    if (!r.ok) {
      return res.status(r.status).json({ error: `Google API returned HTTP ${r.status}` });
    }

    const data = await r.json();
    const translated = (data[0] || []).map((entry: any) => entry[0] || "").join("");
    res.json({ translation: translated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// SPA configuration
const distPath = path.join(process.cwd(), "dist");

async function startServer() {
  // Serve static in production
  if (process.env.NODE_ENV === "production") {
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    // Integrate Vite for development on port 3000
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Hikami Renpy Translator server running on http://localhost:${PORT}`);
  });
}

startServer();
