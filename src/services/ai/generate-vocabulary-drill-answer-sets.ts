import { AI_MODELS } from "@/services/ai/ai-models";
import { createTrackedResponse } from "@/services/ai/openai-tracked-response";
import type {
  VocabularyDrillAnswerSetKey,
  VocabularyDrillAnswerSetMap,
} from "@/types/vocabulary-answer-sets";

type RawVocabularyDrillAnswerSet = {
  drill_correct_answer: string;
  distractors: string[];
};

type RawVocabularyDrillAnswerSetMap = Partial<
  Record<VocabularyDrillAnswerSetKey, RawVocabularyDrillAnswerSet>
>;

const VOCABULARY_DRILL_ANSWER_SETS_SYSTEM_PROMPT = `You are creating answer sets for SAT-style vocabulary drills.

Return ONLY valid JSON in this exact shape:
{"translation_english_to_native":{"drill_correct_answer":"string","distractors":["string","string","string","string"]},"translation_native_to_english":{"drill_correct_answer":"string","distractors":["string","string","string","string"]},"synonym":{"drill_correct_answer":"string","distractors":["string","string","string","string"]},"context_meaning":{"drill_correct_answer":"string","distractors":["string","string","string","string"]},"collocation":{"drill_correct_answer":"string","distractors":["string","string","string","string"]}}

Rules:
- Each answer set must include exactly one drill_correct_answer and exactly four plausible but wrong distractors.
- Keep distractors visually similar to the drill_correct_answer: similar length, same part of speech, similar difficulty, similar style.
- Avoid trivial opposites, joke answers, generic fillers, and obvious mismatches.
- For synonym and context_meaning, do NOT copy the flashcard definition wording verbatim for drill_correct_answer. Paraphrase it into a clean student-facing option.
- Distractors must not simply reuse the flashcard definition wording.
- For translation_native_to_english and collocation, use English words or phrases that match the target item's part of speech and shape.
- For collocation, drill_correct_answer should be the actual target word or phrase, and distractors should still look plausible in the sentence without becoming correct.
- Short answer choices only.
- No explanations.
- No markdown.
- No extra text.`;

function extractJsonObject(text: string): RawVocabularyDrillAnswerSetMap {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return JSON object");
  }

  return JSON.parse(text.slice(start, end + 1));
}

function sanitizeRawAnswerSetMap(
  value: RawVocabularyDrillAnswerSetMap
): RawVocabularyDrillAnswerSetMap {
  const result: RawVocabularyDrillAnswerSetMap = {};

  for (const [key, answerSet] of Object.entries(value)) {
    if (
      !answerSet ||
      typeof answerSet.drill_correct_answer !== "string" ||
      !Array.isArray(answerSet.distractors)
    ) {
      continue;
    }

    result[key as VocabularyDrillAnswerSetKey] = {
      drill_correct_answer: answerSet.drill_correct_answer,
      distractors: answerSet.distractors.filter(
        (candidate): candidate is string => typeof candidate === "string"
      ),
    };
  }

  return result;
}

export async function generateVocabularyDrillAnswerSets(input: {
  itemText: string;
  itemType: "word" | "phrase";
  englishExplanation: string;
  studentId?: string | null;
  translatedExplanation?: string | null;
  contextSentence?: string | null;
  exampleText?: string | null;
  meaningFallbackPool?: string[];
  translationFallbackPool?: string[];
  lexicalFallbackPool?: string[];
  existingAnswerSets?: VocabularyDrillAnswerSetMap | null;
}) {
  const prompt = `${VOCABULARY_DRILL_ANSWER_SETS_SYSTEM_PROMPT}

INPUT_JSON:
${JSON.stringify({
    item_text: input.itemText,
    item_type: input.itemType,
    english_explanation: input.englishExplanation,
    translated_explanation: input.translatedExplanation ?? null,
    context_sentence: input.contextSentence ?? null,
    example_text: input.exampleText ?? null,
    meaning_fallback_pool: input.meaningFallbackPool ?? [],
    translation_fallback_pool: input.translationFallbackPool ?? [],
    lexical_fallback_pool: input.lexicalFallbackPool ?? [],
    existing_answer_sets: input.existingAnswerSets ?? {},
  })}`;

  const response = await createTrackedResponse({
    route: "vocabulary.generate_drill_answer_sets",
    model: AI_MODELS.liveReasoning,
    studentId: input.studentId ?? null,
    input: prompt,
    metadata: {
      item_type: input.itemType,
      has_existing_answer_sets: Boolean(
        input.existingAnswerSets &&
          Object.keys(input.existingAnswerSets).length > 0
      ),
    },
  });

  return sanitizeRawAnswerSetMap(extractJsonObject(response.output_text));
}
