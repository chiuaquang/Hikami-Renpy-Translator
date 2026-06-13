import { DeepLClient } from './deepl-client';

let client: DeepLClient | null = null;

export function getClient(): DeepLClient {
  if (!client) {
    client = new DeepLClient({
      proxyUrl: '/api/deepl-trans',
      maxRetries: 3,
      timeout: 60000,
      useDirectFallback: true,
      debug: false,
      maxConcurrent: 2
    });
  }
  return client;
}

const LANG_MAP: Record<string, { label: string; deepl: string }> = {
  vi: { label: "Vietnamese", deepl: "VI" },
  id: { label: "Indonesian", deepl: "ID" },
  en: { label: "English", deepl: "EN-US" },
  ms: { label: "Malay", deepl: "MS" },
  tl: { label: "Filipino", deepl: "TL" },
  ja: { label: "Japanese", deepl: "JA" },
  ko: { label: "Korean", deepl: "KO" },
  zh: { label: "Chinese (Simplified)", deepl: "ZH" },
  th: { label: "Thai", deepl: "TH" },
  hi: { label: "Hindi", deepl: "HI" },
  fr: { label: "French", deepl: "FR" },
  de: { label: "German", deepl: "DE" },
  es: { label: "Spanish", deepl: "ES" },
  pt: { label: "Portuguese", deepl: "PT-PT" },
  ru: { label: "Russian", deepl: "RU" },
  ar: { label: "Arabic", deepl: "AR" }
};

export function toDeepLTargetLang(langCode: string): string | null {
  return LANG_MAP[langCode]?.deepl || null;
}

export function needsDeepLQualityModel(dlTarget: string): boolean {
  const qualityLangs = ['EN', 'EN-US', 'EN-GB', 'DE', 'FR', 'ES', 'PT-PT', 'PT-BR'];
  return qualityLangs.includes(dlTarget);
}

export async function translateDeepLBatch(linesSafe: string[], targetLang: string, apiKey: string, signal: AbortSignal | null = null): Promise<string[]> {
  if (!Array.isArray(linesSafe) || linesSafe.length === 0) {
    throw new Error('linesSafe must be a non-empty array');
  }
  if (!targetLang) {
    throw new Error('targetLang is required');
  }
  if (!apiKey) {
    throw new Error('apiKey is required');
  }
  
  const dlTarget = toDeepLTargetLang(targetLang);
  if (!dlTarget) {
    throw new Error(`DeepL does not support target language "${targetLang}" in this tool.`);
  }
  
  console.log(`[DeepL] Translating ${linesSafe.length} lines to ${dlTarget}`);
  
  try {
    const deeplClient = getClient();
    const options: any = {
      preserve_formatting: 1,
      split_sentences: 0,
      signal
    };
    
    if (needsDeepLQualityModel(dlTarget)) {
      options.model_type = 'quality_optimized';
    }
    
    const startTime = Date.now();
    const result = await deeplClient.translate({
      apiKey,
      text: linesSafe,
      target_lang: dlTarget,
      options
    });
    
    const duration = Date.now() - startTime;
    console.log(`[DeepL] Translation completed in ${duration}ms`);
    
    if (!result.translations || !Array.isArray(result.translations)) {
      throw new Error('Invalid response format from DeepL');
    }
    
    const translations = result.translations.map((t: any) => t.text || '');
    if (translations.length !== linesSafe.length) {
      throw new Error(`Translation count mismatch: expected ${linesSafe.length}, got ${translations.length}`);
    }
    return translations;
  } catch (error: any) {
    console.error('[DeepL] Translation failed:', error);
    let enhancedMessage = 'DeepL translation failed';
    if (error.status === 403) {
      enhancedMessage = 'Invalid DeepL API key or insufficient permissions';
    } else if (error.status === 456) {
      enhancedMessage = 'DeepL API quota exceeded';
    } else if (error.status === 429) {
      enhancedMessage = 'Too many requests. Please wait and try again';
    } else if (error.status >= 500) {
      enhancedMessage = 'DeepL service temporarily unavailable';
    } else if (error.message) {
      enhancedMessage = error.message;
    }
    
    const enhancedError: any = new Error(enhancedMessage);
    enhancedError.originalError = error;
    enhancedError.status = error.status;
    throw enhancedError;
  }
}

export function initDeepL(options: any = {}): DeepLClient {
  client = new DeepLClient({
    proxyUrl: options.proxyUrl || '/api/deepl-trans',
    maxRetries: options.maxRetries || 3,
    timeout: options.timeout || 60000,
    useDirectFallback: options.useDirectFallback !== false,
    debug: options.debug || false,
    maxConcurrent: options.maxConcurrent || 2
  });
  console.log('[DeepL] Integration initialized');
  return client;
}

export async function testDeepLConnection(apiKey: string): Promise<any> {
  try {
    const result = await translateDeepLBatch(['Hello'], 'vi', apiKey);
    return {
      success: true,
      message: 'DeepL connection successful',
      translation: result[0]
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message,
      error
    };
  }
}
export const DeepLIntegration = {
  translateDeepLBatch,
  initDeepL,
  testDeepLConnection,
  toDeepLTargetLang,
  needsDeepLQualityModel,
  getClient
};
