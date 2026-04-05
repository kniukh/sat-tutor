import { AI_MODELS } from "@/services/ai/ai-models";
import { createTrackedResponse } from "@/services/ai/openai-tracked-response";

type InlinePreview = {
  item_text: string;
  item_type: 'word' | 'phrase';
  plain_english_meaning: string;
  translation: string;
  context_meaning: string;
};

const INLINE_PREVIEW_TIMEOUT_MS = 1800;
const INLINE_REFERENCE_WINDOW_CHARS = 320;
const INLINE_PREVIEW_SYSTEM_PROMPT = `You are helping a student preview a vocabulary item before saving it.

Return ONLY a valid JSON object with:
- item_text
- item_type
- plain_english_meaning
- translation
- context_meaning

Rules:
- plain_english_meaning must be short and simple.
- translation must use the requested target_language.
- context_meaning must explain the meaning in the provided reference_text.
- Keep each field concise.
- Return JSON only, no markdown.

JSON shape:
{"item_text":"string","item_type":"word","plain_english_meaning":"string","translation":"string","context_meaning":"string"}`;

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
  studentId?: string | null;
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

  const prompt = `${INLINE_PREVIEW_SYSTEM_PROMPT}

INPUT_JSON:
${JSON.stringify({
  target_language: targetLanguage,
  reference_text: referenceWindow,
  item_text: input.itemText,
  item_type: input.itemType,
})}`;

  try {
    const response = await Promise.race([
      createTrackedResponse({
        route: "vocabulary.preview_inline",
        model: AI_MODELS.liveReasoning,
        studentId: input.studentId ?? null,
        input: prompt,
        metadata: {
          item_type: input.itemType,
          has_reference_text: Boolean(referenceWindow),
        },
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
