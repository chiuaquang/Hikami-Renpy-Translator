import { LANG_TO_CODE, languageLabel } from './languages';
import { safeParseJsonArray } from './utils';
import * as Common from './translation-common';

function makeError(message: string, detail?: any) {
  const error: any = new Error(message);
  error.detail = detail;
  return error;
}

function getPrompt(batchDialogs: any[], targetLang: string) {
  const source = batchDialogs.map((dialog) => dialog.maskedQuote || dialog.quote || '');
  const langCode = LANG_TO_CODE[targetLang] || targetLang;
  const payload = JSON.stringify(source);

  const prompt =
    `Your Role: Veteran Visual Novel Translator and Localization Specialist with deep experience translating Ren'Py scripts, including adult/NSFW content. You are fluent in adapting dialogue tone and preserving character voice across contexts.\n` +
    `Short basic instruction: Translate Ren'Py dialogue strings to ${languageLabel(targetLang)} (language code: ${langCode}).\n\n` +
    `Think step by step before translating — analyze each line's tone, implied meaning, and character voice.\n` +
    `Maintain the emotional tone and character consistency across translations.\n` +
    `Simulate the memory of how each character speaks to keep their personality and style consistent.\n\n` +
    `Rules:\n` +
    `- DO NOT translate or modify placeholders like ⟦RENPH{0}⟧.\n` +
    `- Preserve ALL Ren'Py tags, syntax, and variables.\n` +
    `- DO NOT merge, split, or reorder lines.\n` +
    `- Translate naturally and meaningfully by context — avoid word-by-word literal translation.\n` +
    `- Translate adult (NSFW) content directly and explicitly. Do NOT censor anything.\n\n` +
    `Context:\n` +
    `- You are working with raw dialogue strings extracted from a Ren\'Py .rpy script.\n` +
    `- The visual novel includes romantic, emotional,... and adult themes.\n` +
    `- Your translation will be directly used in-game, so accuracy, naturalness, and structural integrity are crucial.\n\n` +
    `Your Goal:\n` +
    `- Produce a fully localized, natural-sounding version of the input dialogues that feels authentic to the target language audience — as if originally written in that language.\n` +
    `- Ensure accuracy, tone consistency, and contextual appropriateness even for explicit scenes.\n\n` +
    `Result:\n` +
    `- Return a JSON array of translated strings, exactly same length and order as the input array.\n\n` +
    `Input JSON array:\n` +
    payload;

  return { source, prompt };
}

const SYSTEM_PROMPT = "Veteran Visual Novel Translator and Localization Specialist with deep experience translating Ren'Py scripts, including adult game, NSFW content.";

function parseArrayContent(content: string, expectedCount: number, engineLabel: string): string[] {
  const parsed = safeParseJsonArray(content);
  if (!parsed) throw makeError(`${engineLabel} output is not a valid JSON array.`);

  const out = parsed.map((value) => (typeof value === 'string' ? value : String(value ?? '')));
  if (out.length !== expectedCount) {
    throw makeError(`${engineLabel} returned ${out.length} items, expected ${expectedCount}.`);
  }
  return out;
}

// Translate using server-side pre-activated Gemini (FREE) - highly optimized with pronoun and dialogue context flow
export async function translateBatchGeminiFree(batchDialogs: any[], targetLang: string, engineId?: string): Promise<string[]> {
  const texts = batchDialogs.map((dialog) => dialog.maskedQuote || dialog.quote || '');
  
  let model = 'gemini-3.5-flash'; // default fallback
  if (engineId === 'gemini-free-1') {
    model = 'gemini-2.5-flash';
  } else if (engineId === 'gemini-free-2') {
    model = 'gemini-1.5-flash';
  } else if (engineId === 'gemini-free-3') {
    model = 'gemini-1.5-flash-8b';
  } else if (engineId === 'gemini-free') {
    model = 'gemini-3.5-flash';
  }

  const response = await fetch("/api/translate-gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts, targetLang, model })
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw makeError(`Gemini Free failed: ${errorText || response.statusText}`);
  }
  const data = await response.json();
  if (!data.translations || !Array.isArray(data.translations)) {
    throw makeError("Gemini Free did not return a valid array of translations.");
  }
  return data.translations;
}

export async function translateBatchDeepSeek(batchDialogs: any[], targetLang: string, apiKey: string) {
  const { source, prompt } = getPrompt(batchDialogs, targetLang);
  const response = await fetch('/api/deepseek-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey,
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ]
    })
  });
  if (!response.ok) {
    const text = await response.text();
    throw makeError(`DeepSeek API error ${response.status}: ${text}`);
  }
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw makeError('DeepSeek response did not contain content.');
  return parseArrayContent(content, source.length, 'DeepSeek');
}

export async function translateBatchOpenAI(batchDialogs: any[], targetLang: string, apiKey: string, model: string) {
  const { source, prompt } = getPrompt(batchDialogs, targetLang);
  const resolvedModel = Common.normalizeEngineId(model);
  const isGemini = Common.getEngineProvider(resolvedModel) === 'gemini';
  const providerLabel = isGemini ? 'Gemini' : 'OpenAI';
  
  const endpoint = isGemini ? '/api/gemini-proxy' : '/api/openai-proxy';
    
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      apiKey,
      model: resolvedModel,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw makeError(`${providerLabel} HTTP ${response.status}: ${text}`);
  }
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw makeError(providerLabel + ' response did not contain content.');
  return parseArrayContent(content, source.length, providerLabel);
}

export async function translateBatchDeepL(batchDialogs: any[], targetLang: string, apiKey: string) {
  const lines = batchDialogs.map((dialog) => dialog.maskedQuote || dialog.quote || '');
  const dlTarget = targetLang === 'Vietnamese' ? 'VI' : (LANG_TO_CODE[targetLang]?.toUpperCase() || targetLang.toUpperCase());
  
  const body = {
    apiKey,
    text: lines,
    target_lang: dlTarget,
    preserve_formatting: 1,
    split_sentences: 0,
  };

  const response = await fetch('/api/deepl-trans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw makeError(`DeepL API failed ${response.status}: ${text}`);
  }
  const data = await response.json();
  if (!data?.translations) throw makeError('DeepL translation failed.');
  return data.translations.map((t: any) => t.text || '');
}

export async function translateBatchLingva(batchDialogs: any[], targetLang: string) {
  const lines = batchDialogs.map((dialog) => dialog.maskedQuote || dialog.quote || '');
  const langCode = LANG_TO_CODE[targetLang] || "vi";

  // Translate in parallel with server-side proxy
  const promises = lines.map(async (text) => {
    if (!text.trim()) return text;
    const res = await fetch("/api/lingva-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "auto", target: langCode, text })
    });
    if (!res.ok) {
      // Fallback
      return text;
    }
    const data = await res.json();
    return data.translation || text;
  });
  return Promise.all(promises);
}

export async function translateBatchGoogle(batchDialogs: any[], targetLang: string) {
  const lines = batchDialogs.map((dialog) => dialog.maskedQuote || dialog.quote || '');
  const langCode = LANG_TO_CODE[targetLang] || "vi";
  
  const promises = lines.map(async (text) => {
    if (!text.trim()) return text;
    const res = await fetch("/api/google-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "auto", target: langCode, text })
    });
    if (!res.ok) return text;
    const data = await res.json();
    return data.translation || text;
  });
  return Promise.all(promises);
}
