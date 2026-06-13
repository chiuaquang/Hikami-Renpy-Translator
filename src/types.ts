export interface RenpyDialog {
  lineIndex: number;
  contentStart: number;
  contentEnd: number;
  quoteChar: string;
  isTriple: boolean;
  prefix: string;
  quote: string;
  maskedQuote: string;
  placeholderMap: Record<string, string>;
  translated: string | null;
  flagged?: boolean;
}

export interface FileState {
  path: string;
  source: string;
  eol: string;
  dialogs: RenpyDialog[];
  totalCount?: number;
  translatedCount?: number;
}

export interface ProjectState {
  id: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
}
