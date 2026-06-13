export interface EngineMeta {
  id: string;
  provider: string;
  label: string;
  uiLabel: string;
}

export const ENGINE_CATALOG: readonly EngineMeta[] = Object.freeze([
  { id: 'gemini-free-1', provider: 'gemini-free', label: 'Gemini Free 1', uiLabel: '✨ Aistudio Gemini Bản Free 1 — Tốc độ cao (2.5 Flash)' },
  { id: 'gemini-free-2', provider: 'gemini-free', label: 'Gemini Free 2', uiLabel: '✨ Aistudio Gemini Bản Free 2 — Ổn định (1.5 Flash)' },
  { id: 'gemini-free-3', provider: 'gemini-free', label: 'Gemini Free 3', uiLabel: '✨ Aistudio Gemini Bản Free 3 — Siêu nhẹ (1.5 Flash 8B)' },
  { id: 'gemini-free', provider: 'gemini-free', label: 'Gemini Free', uiLabel: '✨ Aistudio Gemini Bản Free — Thế hệ mới (3.5 Flash)' },
  { id: 'gemini-3.5-flash', provider: 'gemini', label: 'Gemini 3.5 Flash', uiLabel: '🔑 Gemini 3.5 Flash (Gemini Aistudio)' },
  { id: 'gemini-3.5-pro', provider: 'gemini', label: 'Gemini 3.5 Pro', uiLabel: '🔑 Gemini 3.5 Pro (User Key)' },
  { id: 'gemini-2.5-flash', provider: 'gemini', label: 'Gemini 2.5 Flash', uiLabel: '🔑 Gemini 2.5 Flash (Gemini Aistudio)' },
  { id: 'gemini-2.5-pro', provider: 'gemini', label: 'Gemini 2.5 Pro', uiLabel: '🔑 Gemini 2.5 Pro (User Key)' },
  { id: 'gemini-1.5-flash', provider: 'gemini', label: 'Gemini 1.5 Flash', uiLabel: '🔑 Gemini 1.5 Flash (Gemini Aistudio)' },
  { id: 'gemini-1.5-pro', provider: 'gemini', label: 'Gemini 1.5 Pro', uiLabel: '🔑 Gemini 1.5 Pro (User Key)' },
  { id: 'deepseek', provider: 'deepseek', label: 'DeepSeek', uiLabel: '🔥 DeepSeek API — Chất lượng cao (Cần khoá)' },
  { id: 'deepl', provider: 'deepl', label: 'DeepL', uiLabel: '🧠 DeepL API — Bản dịch mượt mà (Cần khoá)' },
  { id: 'gemini-3.1-pro-preview', provider: 'gemini', label: 'Gemini 3.1 Pro', uiLabel: '🔑 Gemini 3.1 Pro (User Key)' },
  { id: 'gemini-3.1-flash-lite-preview', provider: 'gemini', label: 'Gemini 3.1 Flash-Lite', uiLabel: '🔑 Gemini 3.1 Flash-Lite (Gemini Aistudio)' },
  { id: 'gemini-3-flash-preview', provider: 'gemini', label: 'Gemini 3 Flash', uiLabel: '🔑 Gemini 3 Flash (Gemini Aistudio)' },
  { id: 'gpt-4o', provider: 'openai', label: 'ChatGPT 4o', uiLabel: '💎 ChatGPT 4o — Bản dịch tốt nhất (Cần khoá)' },
  { id: 'gpt-4o-mini', provider: 'openai', label: 'ChatGPT 4o mini', uiLabel: '⚡ ChatGPT 4o Mini — Nhanh & Rẻ (Cần khoá)' },
  { id: 'gpt-5.4', provider: 'openai', label: 'ChatGPT 5.4', uiLabel: '🚀 ChatGPT 5.4 — Cao cấp nhất (Cần khoá)' },
  { id: 'gpt-5.4-mini', provider: 'openai', label: 'ChatGPT 5.4 mini', uiLabel: '💡 ChatGPT 5.4 Mini — Cân bằng (Cần khoá)' },
  { id: 'gpt-5.4-nano', provider: 'openai', label: 'ChatGPT 5.4 nano', uiLabel: '📦 ChatGPT 5.4 Nano — Siêu rẻ (Cần khoá)' },
  { id: 'gpt-3.5-turbo', provider: 'openai', label: 'ChatGPT 3.5 Turbo', uiLabel: '🧩 ChatGPT 3.5 Turbo (Cần khoá)' },
  { id: 'lingva', provider: 'free', label: 'Lingva', uiLabel: '🌐 Lingva — Miễn phí (Dịch máy)' },
  { id: 'google', provider: 'free', label: 'Google Translate', uiLabel: '💠 Google Translate — Miễn phí (Tốc độ)' }
]);

const ENGINE_MAP = new Map<string, EngineMeta>(ENGINE_CATALOG.map((item) => [item.id, item]));

const ENGINE_ALIASES: Record<string, string> = Object.freeze({
  libre: 'lingva',
  'google-translate': 'google',
  googletranslate: 'google',
  'gpt-5': 'gpt-5.4',
  'gpt-5-mini': 'gpt-5.4-mini',
  'gpt-5-nano': 'gpt-5.4-nano',
  'deepl-translate': 'deepl',
  'gemini-free': 'gemini-free',
  'gemini-free-1': 'gemini-free-1',
  'gemini-free-2': 'gemini-free-2',
  'gemini-free-3': 'gemini-free-3',
  'gemini-3.5-flash': 'gemini-3.5-flash',
  'gemini-3.5-pro': 'gemini-3.5-pro',
  'gemini-2.5-flash': 'gemini-2.5-flash',
  'gemini-2.5-pro': 'gemini-2.5-pro',
  'gemini-1.5-flash': 'gemini-1.5-flash',
  'gemini-1.5-pro': 'gemini-1.5-pro',
  'gemini-3.1-pro': 'gemini-3.1-pro-preview',
  'gemini 3.1 pro': 'gemini-3.1-pro-preview',
  'gemini-3.1-flash-lite': 'gemini-3.1-flash-lite-preview',
  'gemini 3.1 flash-lite': 'gemini-3.1-flash-lite-preview',
  'gemini 3.1 flash lite': 'gemini-3.1-flash-lite-preview',
  'gemini-3-flash': 'gemini-3-flash-preview',
  'gemini 3 flash': 'gemini-3-flash-preview'
});

export const TARGET_LANGUAGE_OPTIONS = Object.freeze([
  { code: 'en', label: 'English', labelValue: 'English', deepl: 'EN-US' },
  { code: 'zh-CN', label: 'Chinese (Simplified)', labelValue: 'Chinese (Simplified)', deepl: 'ZH' },
  { code: 'hi', label: 'Hindi', labelValue: 'Hindi', deepl: 'HI' },
  { code: 'es', label: 'Spanish', labelValue: 'Spanish', deepl: 'ES' },
  { code: 'fr', label: 'French', labelValue: 'French', deepl: 'FR' },
  { code: 'ar', label: 'Arabic', labelValue: 'Arabic', deepl: 'AR' },
  { code: 'pt', label: 'Portuguese', labelValue: 'Portuguese', deepl: 'PT-PT' },
  { code: 'ru', label: 'Russian', labelValue: 'Russian', deepl: 'RU' },
  { code: 'de', label: 'German', labelValue: 'German', deepl: 'DE' },
  { code: 'ja', label: 'Japanese', labelValue: 'Japanese', deepl: 'JA' },
  { code: 'id', label: 'Indonesian', labelValue: 'Bahasa Indonesia', deepl: 'ID' },
  { code: 'ms', label: 'Malay', labelValue: 'Malay', deepl: 'MS' },
  { code: 'vi', label: 'Vietnamese', labelValue: 'Vietnamese', deepl: 'VI' },
  { code: 'tl', label: 'Filipino', labelValue: 'Filipino', deepl: 'TL' },
  { code: 'ko', label: 'Korean', labelValue: 'Korean', deepl: 'KO' }
]);

export interface ProviderKeyConfig {
  label: string;
  placeholder: string;
  storageKey: string;
}

const PROVIDER_KEY_CONFIG: Record<string, ProviderKeyConfig> = Object.freeze({
  'gemini-free': Object.freeze({
    label: 'Aistudio Gemini (Bản Free)',
    placeholder: 'Đã kích hoạt sẵn! Bạn không cần nhập khoá API cho máy chủ miễn phí.',
    storageKey: ''
  }),
  deepseek: Object.freeze({
    label: 'Khóa API DeepSeek (User Key)',
    placeholder: 'Nhập khóa API DeepSeek của bạn (sk-...)',
    storageKey: 'deepseekApiKey'
  }),
  deepl: Object.freeze({
    label: 'Khóa API DeepL (User Key)',
    placeholder: 'Nhập khóa API DeepL Translator của bạn',
    storageKey: 'deeplApiKey'
  }),
  gemini: Object.freeze({
    label: 'Khóa API Gemini Aistudio',
    placeholder: 'Nhập khóa API Google AI Studio Gemini của bạn (AIzaSy...)',
    storageKey: 'geminiApiKey'
  }),
  openai: Object.freeze({
    label: 'Khóa API ChatGPT (User Key)',
    placeholder: 'Nhập khóa API OpenAI ChatGPT của bạn (sk-...)',
    storageKey: 'openaiApiKey'
  }),
  free: Object.freeze({
    label: 'Không yêu cầu khóa API',
    placeholder: '',
    storageKey: ''
  })
});

const LABEL_BY_CODE: Record<string, string> = Object.freeze({
  en: 'English',
  'en-us': 'English',
  'en-gb': 'English',
  'zh-cn': 'Chinese (Simplified)',
  zh: 'Chinese (Simplified)',
  hi: 'Hindi',
  es: 'Spanish',
  fr: 'French',
  ar: 'Arabic',
  pt: 'Portuguese',
  'pt-pt': 'Portuguese',
  'pt-br': 'Portuguese',
  ru: 'Russian',
  de: 'German',
  ja: 'Japanese',
  id: 'Indonesian',
  'bahasa indonesia': 'Indonesian',
  ms: 'Malay',
  vi: 'Vietnamese',
  'vi-vn': 'Vietnamese',
  tl: 'Filipino',
  fil: 'Filipino',
  ko: 'Korean'
});

const CODE_BY_LABEL: Record<string, string> = Object.freeze({
  english: 'en',
  'chinese (simplified)': 'zh-CN',
  'simplified chinese': 'zh-CN',
  chinese: 'zh-CN',
  hindi: 'hi',
  spanish: 'es',
  french: 'fr',
  arabic: 'ar',
  portuguese: 'pt',
  russian: 'ru',
  german: 'de',
  japanese: 'ja',
  indonesian: 'id',
  'bahasa indonesia': 'id',
  malaysia: 'ms',
  malay: 'ms',
  vietnamese: 'vi',
  filipino: 'tl',
  filipina: 'tl',
  tagalog: 'tl',
  korean: 'ko'
});

export function normalizeEngineId(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) return 'gemini-free';
  const lowered = raw.toLowerCase();
  return ENGINE_ALIASES[lowered] || lowered;
}

export function getEngineMeta(value: string): EngineMeta | null {
  return ENGINE_MAP.get(normalizeEngineId(value)) || null;
}

export function getEngineProvider(value: string): string | null {
  return getEngineMeta(value)?.provider || null;
}

export function getProviderKeyConfig(value: string): ProviderKeyConfig {
  const provider = ENGINE_MAP.has(normalizeEngineId(value))
    ? getEngineProvider(value)
    : String(value || '').toLowerCase().trim();
  return PROVIDER_KEY_CONFIG[provider || 'free'] || PROVIDER_KEY_CONFIG.free;
}

export function isGeminiFreeEngine(value: string): boolean {
  const norm = normalizeEngineId(value);
  return norm === 'gemini-free' || norm === 'gemini-free-1' || norm === 'gemini-free-2' || norm === 'gemini-free-3';
}

export function isOpenAIEngine(value: string): boolean {
  const provider = getEngineProvider(value);
  return provider === 'openai' || provider === 'gemini';
}

export function requiresApiKey(value: string): boolean {
  const provider = getEngineProvider(value);
  return provider === 'deepseek' || provider === 'deepl' || provider === 'openai' || provider === 'gemini';
}

export function getEngineLabel(value: string): string {
  return getEngineMeta(value)?.label || String(value || 'Unknown');
}

export function getProviderErrorLabel(value: string): string {
  const norm = normalizeEngineId(value);
  const provider = getEngineProvider(norm);
  if (isGeminiFreeEngine(norm)) {
    return 'Aistudio Gemini (Bản Free)';
  }
  if (provider === 'gemini') {
    return 'Gemini Aistudio';
  }
  if (provider === 'deepseek') {
    return 'DeepSeek';
  }
  if (provider === 'openai') {
    return 'ChatGPT';
  }
  if (provider === 'deepl') {
    return 'DeepL';
  }
  if (norm === 'google') {
    return 'Google Translate';
  }
  if (norm === 'lingva') {
    return 'Lingva Translate';
  }
  return 'Unknown Provider';
}

export function getEngineOptions() {
  return ENGINE_CATALOG.map((item) => ({ ...item }));
}

export function getTargetOptions(mode = 'code') {
  const useLabelValues = String(mode || '').toLowerCase() === 'label';
  return TARGET_LANGUAGE_OPTIONS.map((item) => ({
    value: useLabelValues ? item.labelValue : item.code,
    label: item.label
  }));
}

export function normalizeTargetCode(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) return 'en';
  const lower = raw.toLowerCase();
  if (CODE_BY_LABEL[lower]) return CODE_BY_LABEL[lower];
  if (lower === 'zh' || lower === 'zh-cn' || lower === 'zh_cn') return 'zh-CN';
  if (lower === 'fil') return 'tl';
  if (/^[a-z]{2}(?:-[a-z0-9]+)?$/i.test(raw)) {
    if (/^zh(?:[-_]?cn)?$/i.test(raw)) return 'zh-CN';
    if (/^fil$/i.test(raw)) return 'tl';
    return raw;
  }
  return raw;
}

export function languageLabel(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) return 'English';
  const lower = raw.toLowerCase();
  if (LABEL_BY_CODE[lower]) return LABEL_BY_CODE[lower];
  if (CODE_BY_LABEL[lower]) return LABEL_BY_CODE[CODE_BY_LABEL[lower].toLowerCase()] || raw;
  return raw;
}

export function fillEngineSelect(selectElement: HTMLSelectElement, activeId?: string) {
  if (!selectElement) return;
  selectElement.innerHTML = '';
  const active = normalizeEngineId(activeId || 'gemini-free');
  for (const item of ENGINE_CATALOG) {
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = item.uiLabel;
    opt.selected = item.id === active;
    selectElement.appendChild(opt);
  }
}

export function fillTargetSelect(selectElement: HTMLSelectElement, activeCode?: string, format = 'code') {
  if (!selectElement) return;
  selectElement.innerHTML = '';
  const normActive = String(activeCode || 'Vietnamese').toLowerCase();
  for (const item of TARGET_LANGUAGE_OPTIONS) {
    const opt = document.createElement('option');
    opt.value = format === 'label' ? item.label : item.code;
    opt.textContent = item.label;
    if (format === 'label') {
      opt.selected = item.label.toLowerCase() === normActive;
    } else {
      opt.selected = item.code.toLowerCase() === normActive;
    }
    selectElement.appendChild(opt);
  }
}

