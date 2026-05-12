export type SourceSentenceMatch = {
  sentence: string;
  sentenceStart: number;
  sentenceEnd: number;
  itemStart: number | null;
  itemEnd: number | null;
};

const ABBREVIATIONS = new Set([
  "mr",
  "mrs",
  "ms",
  "dr",
  "prof",
  "sr",
  "jr",
  "st",
  "vs",
  "etc",
  "e.g",
  "i.e",
  "u.s",
  "u.k",
]);

function normalizeWhitespace(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function isSentenceBoundary(text: string, index: number) {
  const char = text[index];
  if (char === "?" || char === "!") {
    return true;
  }

  if (char !== ".") {
    return false;
  }

  const before = text.slice(Math.max(0, index - 8), index).match(/[A-Za-z.]+$/)?.[0] ?? "";
  const normalizedBefore = before.toLowerCase().replace(/\.$/, "");

  if (ABBREVIATIONS.has(normalizedBefore)) {
    return false;
  }

  if (index > 0 && index < text.length - 1 && /\d/.test(text[index - 1]) && /\d/.test(text[index + 1])) {
    return false;
  }

  return true;
}

function skipOpeningBoundarySpace(text: string, index: number) {
  let cursor = index;
  while (cursor < text.length && /\s/.test(text[cursor])) {
    cursor += 1;
  }
  return cursor;
}

function includeClosingPunctuation(text: string, index: number) {
  let cursor = index;
  while (cursor < text.length && /["'”’)\]]/.test(text[cursor])) {
    cursor += 1;
  }
  return cursor;
}

function findSentenceStart(text: string, anchor: number) {
  for (let index = Math.max(0, anchor - 1); index >= 0; index -= 1) {
    if (isSentenceBoundary(text, index)) {
      return skipOpeningBoundarySpace(text, index + 1);
    }
  }

  return skipOpeningBoundarySpace(text, 0);
}

function findSentenceEnd(text: string, anchor: number) {
  for (let index = Math.max(0, anchor); index < text.length; index += 1) {
    if (isSentenceBoundary(text, index)) {
      return includeClosingPunctuation(text, index + 1);
    }
  }

  return text.length;
}

function findItemOffset(sourceText: string, itemText: string, preferredOffset?: number | null) {
  const normalizedItem = itemText.trim().toLowerCase();
  if (!normalizedItem) {
    return -1;
  }

  const normalizedSource = sourceText.toLowerCase();
  if (typeof preferredOffset === "number" && preferredOffset >= 0) {
    const nearbyStart = Math.max(0, preferredOffset - normalizedItem.length - 4);
    const nearbyEnd = Math.min(sourceText.length, preferredOffset + normalizedItem.length + 4);
    const nearbyIndex = normalizedSource.slice(nearbyStart, nearbyEnd).indexOf(normalizedItem);

    if (nearbyIndex >= 0) {
      return nearbyStart + nearbyIndex;
    }
  }

  return normalizedSource.indexOf(normalizedItem);
}

export function extractSourceSentence(params: {
  sourceText: string | null | undefined;
  itemText: string | null | undefined;
  itemStartOffset?: number | null;
}): SourceSentenceMatch | null {
  const sourceText = params.sourceText ?? "";
  const itemText = params.itemText?.trim() ?? "";

  if (!sourceText.trim() || !itemText) {
    return null;
  }

  const itemStart = findItemOffset(sourceText, itemText, params.itemStartOffset);
  const anchor = itemStart >= 0 ? itemStart : Math.min(sourceText.length - 1, Math.max(0, params.itemStartOffset ?? 0));
  const sentenceStart = findSentenceStart(sourceText, anchor);
  const sentenceEnd = findSentenceEnd(sourceText, itemStart >= 0 ? itemStart + itemText.length : anchor);
  const sentence = normalizeWhitespace(sourceText.slice(sentenceStart, sentenceEnd));

  if (!sentence) {
    return null;
  }

  return {
    sentence,
    sentenceStart,
    sentenceEnd,
    itemStart: itemStart >= 0 ? itemStart : null,
    itemEnd: itemStart >= 0 ? itemStart + itemText.length : null,
  };
}

export function buildContextSnippet(sourceText: string, itemText: string, itemStartOffset?: number | null) {
  const match = extractSourceSentence({
    sourceText,
    itemText,
    itemStartOffset,
  });

  if (match?.sentence) {
    return match.sentence;
  }

  const lowerText = sourceText.toLowerCase();
  const lowerItem = itemText.toLowerCase();
  const index = lowerText.indexOf(lowerItem);

  if (index === -1) {
    return normalizeWhitespace(sourceText).slice(0, 140) || null;
  }

  const start = Math.max(0, index - 28);
  const end = Math.min(sourceText.length, index + itemText.length + 28);
  return normalizeWhitespace(sourceText.slice(start, end));
}
