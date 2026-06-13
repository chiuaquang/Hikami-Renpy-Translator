export interface TextDialog {
  quote: string;
  translated: string | null;
  [key: string]: any;
}

/**
 * Exports Dialogue array to clean, humand-readable txt file format.
 */
export function exportToTxt(dialogs: TextDialog[], filename: string): string {
  let out = `# HIKAMI RENPY TRANSLATOR - TEXT EXPORT\n`;
  out += `# FILE: ${filename}\n`;
  out += `# CRITICAL: Do NOT alter or delete the "### ID: <num>" headers.\n`;
  out += `# Translate the text after "Translation:". You can use multiple lines if needed.\n`;
  out += `# Any lines starting with "#" are comments and will be ignored by the importer.\n\n`;

  for (let i = 0; i < dialogs.length; i++) {
    const d = dialogs[i];
    out += `### ID: ${i + 1}\n`;
    
    // Write source line-by-line commented out
    const srcLines = String(d.quote ?? '').split('\n');
    for (const line of srcLines) {
      out += `# Source: ${line}\n`;
    }
    
    const trVal = d.translated !== null ? String(d.translated) : '';
    out += `Translation: ${trVal}\n\n`;
  }
  
  return out;
}

/**
 * Imports translations from txt content matching by ### ID.
 */
export function importFromTxt(txt: string, dialogs: TextDialog[]): { updatedCount: number; updatedDialogs: TextDialog[] } {
  const blocks: { index: number; content: string }[] = [];
  const regex = /^### ID:\s*(\d+)/gm;
  
  let match;
  const matches: { id: number; pos: number }[] = [];
  while ((match = regex.exec(txt)) !== null) {
    matches.push({
      id: parseInt(match[1], 10),
      pos: match.index
    });
  }
  
  for (let i = 0; i < matches.length; i++) {
    const startPos = matches[i].pos;
    const endPos = (i + 1 < matches.length) ? matches[i + 1].pos : txt.length;
    const blockContent = txt.slice(startPos, endPos);
    blocks.push({
      index: matches[i].id - 1, // 1-based ID to 0-based index
      content: blockContent
    });
  }
  
  const updatedDialogs = dialogs.map(d => ({ ...d }));
  let updatedCount = 0;
  
  for (const block of blocks) {
    const idx = block.index;
    if (idx < 0 || idx >= updatedDialogs.length) {
      continue;
    }
    
    const transIndex = block.content.indexOf('Translation:');
    if (transIndex === -1) continue;
    
    let translationContent = block.content.slice(transIndex + 'Translation:'.length);
    
    if (translationContent.startsWith(' ')) {
      translationContent = translationContent.slice(1);
    }
    
    // Trim trailing whitespace of the whole translation block
    translationContent = translationContent.trimEnd();
    
    // Normalize newlines
    translationContent = translationContent.replace(/\r\n/g, '\n');
    
    const d = updatedDialogs[idx];
    const prev = d.translated;
    
    const currentNormalized = translationContent === '' ? null : translationContent;
    if (currentNormalized !== (prev ?? null)) {
      d.translated = currentNormalized;
      updatedCount++;
    }
  }
  
  return { updatedCount, updatedDialogs };
}
