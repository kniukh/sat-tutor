"use client";

export type CachedInlinePreview = {
  item_text: string;
  item_type: "word" | "phrase";
  plain_english_meaning: string;
  translation: string;
  context_meaning: string;
};

const INLINE_PREVIEW_CACHE_TTL_MS = 1000 * 60 * 10;

const inlinePreviewCache = new Map<
  string,
  {
    value: CachedInlinePreview;
    cachedAt: number;
  }
>();

function hashText(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}

export function buildInlinePreviewCacheKey(input: {
  studentId: string;
  lessonId: string;
  itemText: string;
  sourceText?: string | null;
}) {
  return [
    input.studentId.trim(),
    input.lessonId.trim(),
    input.itemText.trim().toLowerCase(),
    hashText((input.sourceText ?? "").replace(/\s+/g, " ").trim()),
  ].join(":");
}

export function getCachedInlinePreview(key: string) {
  const entry = inlinePreviewCache.get(key);

  if (!entry) {
    return null;
  }

  if (Date.now() - entry.cachedAt > INLINE_PREVIEW_CACHE_TTL_MS) {
    inlinePreviewCache.delete(key);
    return null;
  }

  return entry.value;
}

export function setCachedInlinePreview(key: string, value: CachedInlinePreview) {
  inlinePreviewCache.set(key, {
    value,
    cachedAt: Date.now(),
  });
}
