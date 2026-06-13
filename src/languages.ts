export const TARGET_LANGS = [
  'English',
  'Chinese (Simplified)',
  'Hindi',
  'Spanish',
  'French',
  'Arabic',
  'Portuguese',
  'Russian',
  'German',
  'Japanese',
  'Bahasa Indonesia',
  'Malay',
  'Vietnamese',
  'Filipino',
  'Korean',
];

export const LANG_TO_CODE: Record<string, string> = Object.freeze({
  'English': 'en',
  'Chinese (Simplified)': 'zh',
  'Hindi': 'hi',
  'Spanish': 'es',
  'French': 'fr',
  'Arabic': 'ar',
  'Portuguese': 'pt',
  'Russian': 'ru',
  'German': 'de',
  'Japanese': 'ja',
  'Bahasa Indonesia': 'id',
  'Malay': 'ms',
  'Vietnamese': 'vi',
  'Filipino': 'tl',
  'Korean': 'ko',
});

export const DEEPL_TARGET: Record<string, string> = Object.freeze({
  'English': 'EN',
  'Chinese (Simplified)': 'ZH',
  'Spanish': 'ES',
  'French': 'FR',
  'Arabic': 'AR',
  'Portuguese': 'PT-PT',
  'German': 'DE',
  'Japanese': 'JA',
  'Korean': 'KO',
});

export function languageLabel(name: string): string {
  return String(name || 'English');
}
