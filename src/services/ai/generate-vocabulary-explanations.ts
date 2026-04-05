import { AI_MODELS } from "@/services/ai/ai-models";
import { createTrackedResponse } from "@/services/ai/openai-tracked-response";

type VocabularyExplanation = {
  item_text: string;
  item_type: 'word' | 'phrase';
  plain_english_meaning: string;
  translation: string;
  context_meaning: string;
  example_text: string;
  context_sentence: string;
};

function extractJson(text: string): VocabularyExplanation[] {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Model did not return a JSON array');
  }

  const raw = text.slice(start, end + 1);
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error('Parsed result is not an array');
  }

  return parsed;
}

export async function generateVocabularyExplanations(input: {
  nativeLanguage: string;
  passageText: string;
  items: Array<{
    item_text: string;
    item_type: 'word' | 'phrase';
  }>;
}) {
  const languageMap: Record<string, string> = {
    ru: 'Russian',
    ro: 'Romanian',
    en: 'English',
  };

  const targetLanguage = languageMap[input.nativeLanguage] ?? 'Russian';

  const prompt = `${VOCABULARY_EXPLANATIONS_SYSTEM_PROMPT}

INPUT_JSON:
${JSON.stringify({
  target_language: targetLanguage,
  passage_text: input.passageText,
  items: input.items,
})}`;

  const response = await createTrackedResponse({
    route: "vocabulary.generate_explanations",
    model: AI_MODELS.liveReasoning,
    input: prompt,
    metadata: {
      item_count: input.items.length,
      target_language: targetLanguage,
    },
  });

  return extractJson(response.output_text);
}
const VOCABULARY_EXPLANATIONS_SYSTEM_PROMPT = `You are helping a student understand difficult vocabulary from a literary passage.

Task:
For each item, return:
- item_text
- item_type
- plain_english_meaning
- translation
- context_meaning
- example_text
- context_sentence

Rules:
- plain_english_meaning must be simple and short.
- translation must use the requested target_language.
- context_meaning must explain what the item means in this passage.
- example_text should be short and clear.
- context_sentence must be a short sentence from or based on the passage context containing the item.
- Return ONLY valid JSON array, no markdown, no commentary.

JSON shape:
[{"item_text":"string","item_type":"word","plain_english_meaning":"string","translation":"string","context_meaning":"string","example_text":"string","context_sentence":"string"}]`;
