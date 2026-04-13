import { AI_MODELS } from "@/services/ai/ai-models";
import { createTrackedResponse } from "@/services/ai/openai-tracked-response";
import type {
  VocabularyDrillAnswerSetKey,
  VocabularyDrillAnswerSetMap,
  VocabularyDrillAnswerSetMeta,
} from "@/types/vocabulary-answer-sets";

type RawVocabularyDrillAnswerSet = {
  drill_correct_answer: string;
  distractors: string[];
};

type RawVocabularyDrillAnswerSetMap = Partial<
  Record<VocabularyDrillAnswerSetKey, RawVocabularyDrillAnswerSet>
>;

type RawVocabularyDrillAnswerSetBatchItem = {
  item_text?: string;
  refined_definition?: string;
  alternate_definitions?: unknown;
  context_explanation?: string;
  practice_example_sentence?: string;
  synonym_candidates?: unknown;
  antonym_candidates?: unknown;
  collocation_candidates?: unknown;
  confusion_pairs?: unknown;
  answer_sets?: RawVocabularyDrillAnswerSetMap;
};

export type VocabularyDrillAnswerSetBatchInput = {
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
};

export type VocabularyDrillAnswerSetBatchResult = {
  answerSets: RawVocabularyDrillAnswerSetMap;
  meta: VocabularyDrillAnswerSetMeta;
};

const VOCABULARY_DRILL_ANSWER_SETS_BATCH_SYSTEM_PROMPT = `You are creating reusable answer sets for SAT-style vocabulary drills.

Return ONLY valid JSON in this exact shape:
{"items":[{"item_text":"string","refined_definition":"string","alternate_definitions":["string"],"context_explanation":"string","practice_example_sentence":"string","synonym_candidates":["string","string"],"antonym_candidates":["string"],"collocation_candidates":["string"],"confusion_pairs":["string"],"answer_sets":{"translation_english_to_native":{"drill_correct_answer":"string","distractors":["string","string","string","string"]},"translation_native_to_english":{"drill_correct_answer":"string","distractors":["string","string","string","string"]},"synonym":{"drill_correct_answer":"string","distractors":["string","string","string","string"]},"context_meaning":{"drill_correct_answer":"string","distractors":["string","string","string","string"]},"collocation":{"drill_correct_answer":"string","distractors":["string","string","string","string"]}}}]}

Rules:
- Preserve each item_text exactly.
- Every answer_sets entry must include exactly one drill_correct_answer and exactly four plausible but wrong distractors.
- Keep distractors visually similar to the drill_correct_answer: similar length, same part of speech, similar difficulty, similar style.
- Avoid trivial opposites, joke answers, generic fillers, and obvious mismatches.
- For synonym and context_meaning, do NOT copy the flashcard definition wording verbatim for drill_correct_answer. Paraphrase it into a clean student-facing option.
- Distractors must not simply reuse the flashcard definition wording.
- For translation_native_to_english and collocation, use English words or phrases that match the target item's part of speech and shape.
- For collocation, drill_correct_answer should be the actual target word or phrase, and distractors should still look plausible in the sentence without becoming correct.
- refined_definition should be a short polished definition if you can improve wording; otherwise closely match the provided definition.
- alternate_definitions should contain 1-3 short paraphrase variants when useful; otherwise [].
- context_explanation should be one short sentence only when the supplied context clarifies the sense; otherwise return an empty string.
- practice_example_sentence should be one short, natural, complete English sentence that uses item_text in the intended sense.
- practice_example_sentence must not be a passage fragment, must end with punctuation, and should usually be 8-16 words.
- If item_text is a phrase, keep the full phrase exactly in the sentence.
- synonym_candidates should contain 2-4 short plausible near-synonyms.
- antonym_candidates should contain 0-3 short plausible antonyms only when the opposite is natural and high-confidence; otherwise return [].
- collocation_candidates should contain 0-4 short natural collocation partners or phrase fragments that commonly pair with item_text.
- confusion_pairs should contain 0-4 short high-confidence words or phrases that students might confuse with item_text.
- Short answer choices only.
- No explanations outside the JSON fields.
- No markdown.
- No extra text.`;

function normalizeBatchItemKey(text: string) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeWhitespace(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeCandidate(text: string) {
  return normalizeWhitespace(text).replace(/[.!?;:,]+$/g, "");
}

function extractJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return JSON object");
  }

  return JSON.parse(text.slice(start, end + 1)) as {
    items?: RawVocabularyDrillAnswerSetBatchItem[];
  };
}

function sanitizeRawAnswerSetMap(
  value: RawVocabularyDrillAnswerSetMap | null | undefined
): RawVocabularyDrillAnswerSetMap {
  const result: RawVocabularyDrillAnswerSetMap = {};

  for (const [key, answerSet] of Object.entries(value ?? {})) {
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

function sanitizeCandidateList(value: unknown, limit: number) {
  if (!Array.isArray(value)) {
    return [];
  }

  const deduped = new Map<string, string>();

  for (const candidate of value) {
    if (typeof candidate !== "string") {
      continue;
    }

    const normalized = normalizeCandidate(candidate);
    const compareKey = normalized.toLowerCase();

    if (!normalized || !compareKey || deduped.has(compareKey)) {
      continue;
    }

    deduped.set(compareKey, normalized);
  }

  return Array.from(deduped.values()).slice(0, limit);
}

function sanitizeBatchMeta(item: RawVocabularyDrillAnswerSetBatchItem): VocabularyDrillAnswerSetMeta {
  const refinedDefinition = normalizeCandidate(item.refined_definition ?? "");
  const alternateDefinitions = sanitizeCandidateList(item.alternate_definitions, 3);
  const contextExplanation = normalizeCandidate(item.context_explanation ?? "");
  const practiceExampleSentence = normalizeWhitespace(item.practice_example_sentence ?? "");
  const synonymCandidates = sanitizeCandidateList(item.synonym_candidates, 4);
  const antonymCandidates = sanitizeCandidateList(item.antonym_candidates, 3);
  const collocationCandidates = sanitizeCandidateList(item.collocation_candidates, 4);
  const confusionPairs = sanitizeCandidateList(item.confusion_pairs, 4);

  return {
    refined_definition: refinedDefinition || null,
    alternate_definitions: alternateDefinitions,
    context_explanation: contextExplanation || null,
    practice_example_sentence: practiceExampleSentence || null,
    synonym_candidates: synonymCandidates,
    antonym_candidates: antonymCandidates,
    collocation_candidates: collocationCandidates,
    confusion_pairs: confusionPairs,
  };
}

function hasAnswerSetMeta(meta: VocabularyDrillAnswerSetMeta | null | undefined) {
  return Boolean(
        meta &&
      ((meta.refined_definition && meta.refined_definition.trim()) ||
        (meta.alternate_definitions?.length ?? 0) > 0 ||
        (meta.context_explanation && meta.context_explanation.trim()) ||
        (meta.practice_example_sentence && meta.practice_example_sentence.trim()) ||
        (meta.synonym_candidates?.length ?? 0) > 0 ||
        (meta.antonym_candidates?.length ?? 0) > 0 ||
        (meta.collocation_candidates?.length ?? 0) > 0 ||
        (meta.confusion_pairs?.length ?? 0) > 0 ||
        (meta.enriched_at && meta.enriched_at.trim()))
  );
}

function extractBatchJsonObject(text: string) {
  const parsed = extractJsonObject(text);

  return (parsed.items ?? [])
    .filter(
      (
        item
      ): item is Required<Pick<RawVocabularyDrillAnswerSetBatchItem, "item_text">> &
        RawVocabularyDrillAnswerSetBatchItem => typeof item?.item_text === "string"
    )
    .map((item) => ({
      item_text: item.item_text,
      answer_sets: sanitizeRawAnswerSetMap(item.answer_sets),
      meta: sanitizeBatchMeta(item),
    }));
}

export async function generateVocabularyDrillAnswerSets(input: VocabularyDrillAnswerSetBatchInput) {
  const batchResult = await generateVocabularyDrillAnswerSetsBatch([input]);
  const result = batchResult.get(normalizeBatchItemKey(input.itemText));

  if (!result) {
    throw new Error("Model did not return answer sets for the requested item");
  }

  const mergedResult: RawVocabularyDrillAnswerSetMap & {
    __meta__?: VocabularyDrillAnswerSetMeta;
  } = {
    ...result.answerSets,
  };

  if (hasAnswerSetMeta(result.meta)) {
    mergedResult.__meta__ = result.meta;
  }

  return mergedResult;
}

export async function generateVocabularyDrillAnswerSetsBatch(
  items: VocabularyDrillAnswerSetBatchInput[]
) {
  if (items.length === 0) {
    return new Map<string, VocabularyDrillAnswerSetBatchResult>();
  }

  const prompt = `${VOCABULARY_DRILL_ANSWER_SETS_BATCH_SYSTEM_PROMPT}

INPUT_JSON:
${JSON.stringify({
    items: items.map((item) => ({
      item_text: item.itemText,
      item_type: item.itemType,
      english_explanation: item.englishExplanation,
      translated_explanation: item.translatedExplanation ?? null,
      context_sentence: item.contextSentence ?? null,
      example_text: item.exampleText ?? null,
      meaning_fallback_pool: item.meaningFallbackPool ?? [],
      translation_fallback_pool: item.translationFallbackPool ?? [],
      lexical_fallback_pool: item.lexicalFallbackPool ?? [],
      existing_answer_sets: item.existingAnswerSets ?? {},
    })),
  })}`;

  const response = await createTrackedResponse({
    route:
      items.length === 1
        ? "vocabulary.generate_drill_answer_sets"
        : "vocabulary.generate_drill_answer_sets_batch",
    model: AI_MODELS.liveReasoning,
    studentId: items.find((item) => item.studentId)?.studentId ?? null,
    input: prompt,
    metadata: {
      item_count: items.length,
      has_existing_answer_sets: items.some(
        (item) =>
          item.existingAnswerSets &&
          Object.keys(item.existingAnswerSets).filter((key) => key !== "__meta__").length > 0
      ),
    },
  });

  const enrichedAt = new Date().toISOString();

  return new Map(
    extractBatchJsonObject(response.output_text).map((item) => [
      normalizeBatchItemKey(item.item_text),
      {
        answerSets: item.answer_sets,
        meta: hasAnswerSetMeta(item.meta)
          ? {
              ...item.meta,
              enriched_at: enrichedAt,
            }
          : {
              enriched_at: enrichedAt,
            },
      },
    ])
  );
}
