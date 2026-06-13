export function nowIso() {
  return new Date().toISOString();
}

export function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

export function debounce<T extends (...args: any[]) => any>(fn: T, ms: number) {
  let t: any = 0;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function escapeHtml(s: string) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function safeParseJsonArray(text: string): string[] | null {
  const s = String(text || '').trim();
  const start = s.indexOf('[');
  const end = s.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;
  const cut = s.slice(start, end + 1);
  try {
    const v = JSON.parse(cut);
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

export function pickFirstNonEmpty(arr: string[]) {
  for (const x of arr) {
    const s = String(x || '').trim();
    if (s) return s;
  }
  return '';
}

export function normalizeLineEndings(text: string) {
  const s = String(text ?? '');
  const eol = s.includes('\r\n') ? '\r\n' : '\n';
  return { text: s.replace(/\r\n/g, '\n'), eol };
}

export function restoreLineEndings(text: string, eol: string) {
  if (!eol || eol === '\n') return text;
  return String(text ?? '').replace(/\n/g, eol);
}

export async function yieldToMain() {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()));
    return;
  }
  await sleep(0);
}
