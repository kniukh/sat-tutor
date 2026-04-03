import { openai } from '@/lib/openai';

type InlinePreview = {
  item_text: string;
  item_type: 'word' | 'phrase';
  plain_english_meaning: string;
  translation: string;
  context_meaning: string;
};

const INLINE_PREVIEW_TIMEOUT_MS = 1800;
const INLINE_REFERENCE_WINDOW_CHARS = 320;

function extractJsonObject(text: string): InlinePreview {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Model did not return JSON object');
  }

  return JSON.parse(text.slice(start, end + 1));
}

function buildReferenceWindow(text: string, itemText: string) {
  const normalizedText = text.replace(/\s+/g, " ").trim();
  if (!normalizedText) {
    return "";
  }

  const lowerText = normalizedText.toLowerCase();
  const lowerItem = itemText.trim().toLowerCase();
  const index = lowerText.indexOf(lowerItem);

  if (index === -1) {
    return normalizedText.slice(0, INLINE_REFERENCE_WINDOW_CHARS);
  }

  const start = Math.max(0, index - 140);
  const end = Math.min(
    normalizedText.length,
    index + itemText.length + 140
  );

  return normalizedText.slice(start, end).trim();
}

function buildFallbackPreview(input: {
  itemText: string;
  itemType: 'word' | 'phrase';
  referenceText: string;
}): InlinePreview {
  const contextMeaning = input.referenceText
    ? `Used in this local context: "${input.referenceText}".`
    : "Used in this local context of the lesson.";

  return {
    item_text: input.itemText,
    item_type: input.itemType,
    plain_english_meaning: "Quick preview not ready yet.",
    translation: "",
    context_meaning: contextMeaning,
  };
}

export async function generateInlineVocabularyPreview(input: {
  nativeLanguage: string;
  passageText: string;
  itemText: string;
  itemType: 'word' | 'phrase';
}) {
  const languageMap: Record<string, string> = {
    ru: 'Russian',
    ro: 'Romanian',
    en: 'English',
  };

  const targetLanguage = languageMap[input.nativeLanguage] ?? 'Russian';
  const referenceWindow = buildReferenceWindow(input.passageText, input.itemText);
  const fallback = buildFallbackPreview({
    itemText: input.itemText,
    itemType: input.itemType,
    referenceText: referenceWindow,
  });

  const prompt = `
You are helping a student preview a vocabulary item before saving it.

Return ONLY valid JSON object with:
- item_text
- item_type
- plain_english_meaning
- translation
- context_meaning

Rules:
- plain_english_meaning must be short and simple
- translation must be in ${targetLanguage}
- context_meaning must explain the meaning in THIS text
- keep each field concise
- return JSON only

Reference text:
${referenceWindow}

Item:
${input.itemText}

Item type:
${input.itemType}

JSON shape:
{
  "item_text": "string",
  "item_type": "word",
  "plain_english_meaning": "string",
  "translation": "string",
  "context_meaning": "string"
}
`;

  try {
    const response = await Promise.race([
      openai.responses.create({
        model: 'gpt-5-mini',
        input: prompt,
      }),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), INLINE_PREVIEW_TIMEOUT_MS)
      ),
    ]);

    if (!response) {
      return fallback;
    }

    return {
      ...fallback,
      ...extractJsonObject(response.output_text),
    };
  } catch {
    return fallback;
  }
}
