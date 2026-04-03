import "server-only";

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

const inlinePreviewInflight = new Map<string, Promise<CachedInlinePreview>>();

function hashText(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}

export function buildServerInlinePreviewCacheKey(input: {
  lessonId: string;
  nativeLanguage: string;
  itemText: string;
  sourceText: string;
}) {
  return [
    input.lessonId.trim(),
    input.nativeLanguage.trim().toLowerCase(),
    input.itemText.trim().toLowerCase(),
    hashText(input.sourceText.replace(/\s+/g, " ").trim()),
  ].join(":");
}

export function getCachedServerInlinePreview(key: string) {
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

export function setCachedServerInlinePreview(key: string, value: CachedInlinePreview) {
  inlinePreviewCache.set(key, {
    value,
    cachedAt: Date.now(),
  });
}

export async function getOrCreateCachedServerInlinePreview(
  key: string,
  loader: () => Promise<CachedInlinePreview>
) {
  const cached = getCachedServerInlinePreview(key);

  if (cached) {
    return cached;
  }

  const existingPromise = inlinePreviewInflight.get(key);

  if (existingPromise) {
    return existingPromise;
  }

  const nextPromise = loader()
    .then((value) => {
      setCachedServerInlinePreview(key, value);
      return value;
    })
    .finally(() => {
      inlinePreviewInflight.delete(key);
    });

  inlinePreviewInflight.set(key, nextPromise);

  return nextPromise;
}
