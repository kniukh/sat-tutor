import { AI_MODELS } from "@/services/ai/ai-models";
import { createTrackedResponse } from "@/services/ai/openai-tracked-response";

type DrillOptionResult = {
  correct_answer: string;
  distractors: string[];
};

export type VocabularyDrillOptionBatchInput = {
  itemText: string;
  itemType: "word" | "phrase";
  plainEnglishMeaning: string;
  studentId?: string | null;
  contextSentence?: string | null;
  exampleText?: string | null;
  existingDistractors?: string[];
  fallbackPool?: string[];
};

const VOCABULARY_DRILL_OPTIONS_SYSTEM_PROMPT = `You are creating vocabulary drill answer choices.

Return ONLY valid JSON in this shape:
{"items":[{"item_text":"string","correct_answer":"string","distractors":["string","string","string","string"]}]}

Rules:
- Preserve each item_text exactly.
- correct_answer must match the meaning.
- Each distractors array must contain exactly 4 plausible but wrong answer choices.
- Distractors should match the same part of speech or answer style as the correct answer.
- Distractors should be close in difficulty, tone, and length to the correct answer.
- Distractors should be semantically nearby enough to feel plausible in SAT practice.
- Avoid obvious antonyms, joke answers, trivia, and generic fillers such as "thing", "good", or "bad".
- If context is available, keep distractors plausible in context without becoming correct.
- Short answers only.
- No markdown.
- No extra text.`;

function normalizeBatchItemKey(text: string) {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?;:,]+$/g, "")
    .toLowerCase();
}

function extractBatchJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return JSON object");
  }

  const parsed = JSON.parse(text.slice(start, end + 1)) as {
    items?: Array<{
      item_text?: string;
      correct_answer?: string;
      distractors?: unknown;
    }>;
  };

  return (parsed.items ?? [])
    .filter(
      (
        item
      ): item is {
        item_text: string;
        correct_answer: string;
        distractors: string[];
      } =>
        typeof item?.item_text === "string" &&
        typeof item.correct_answer === "string" &&
        Array.isArray(item.distractors)
    )
    .map((item) => ({
      item_text: item.item_text,
      correct_answer: item.correct_answer,
      distractors: item.distractors.filter(
        (candidate): candidate is string => typeof candidate === "string"
      ),
    }));
}

export async function generateVocabularyDrillOptions(input: {
  itemText: string;
  itemType: 'word' | 'phrase';
  plainEnglishMeaning: string;
  studentId?: string | null;
  contextSentence?: string | null;
  exampleText?: string | null;
  existingDistractors?: string[];
  fallbackPool?: string[];
}) {
  const batchResult = await generateVocabularyDrillOptionsBatch([input]);
  const result = batchResult.get(normalizeBatchItemKey(input.itemText));

  if (result) {
    return result;
  }

  throw new Error("Model did not return drill options for the requested item");
}

export async function generateVocabularyDrillOptionsBatch(
  items: VocabularyDrillOptionBatchInput[]
) {
  if (items.length === 0) {
    return new Map<string, DrillOptionResult>();
  }

  const prompt = `${VOCABULARY_DRILL_OPTIONS_SYSTEM_PROMPT}

INPUT_JSON:
${JSON.stringify({
    items: items.map((item) => ({
      item_text: item.itemText,
      item_type: item.itemType,
      meaning: item.plainEnglishMeaning,
      context_sentence: item.contextSentence ?? null,
      example_text: item.exampleText ?? null,
      existing_distractors: item.existingDistractors ?? [],
      fallback_pool: item.fallbackPool ?? [],
    })),
  })}`;

  const response = await createTrackedResponse({
    route: "vocabulary.generate_drill_options_batch",
    model: AI_MODELS.liveReasoning,
    studentId: items.find((item) => item.studentId)?.studentId ?? null,
    input: prompt,
    metadata: {
      item_count: items.length,
    },
  });

  return new Map(
    extractBatchJsonObject(response.output_text).map((item) => [
      normalizeBatchItemKey(item.item_text),
      {
        correct_answer: item.correct_answer,
        distractors: item.distractors,
      },
    ])
  );
}
