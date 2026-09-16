import type {
  VocabularyDrillAnswerSetKey,
  VocabularyDrillAnswerSetMap,
} from "@/types/vocabulary-answer-sets";
import {
  isPlaceholderVocabularyDefinition,
  isPlaceholderVocabularyTranslation,
} from "@/services/vocabulary/vocabulary-placeholder-content";

export type VocabularyGoldContentFields = {
  coreMeaning: string | null;
  definition: string | null;
  translationWord: string | null;
  translationMeaning: string | null;
  synonyms: string[];
  antonyms: string[];
  exampleSentence: string | null;
  exampleTranslation: string | null;
  audioText: string;
  partOfSpeech: string | null;
};

export type ResolveSafeVocabularyDrillContentInput = {
  itemText: string;
  itemType?: string | null;
  englishExplanation?: string | null;
  translatedExplanation?: string | null;
  exampleText?: string | null;
  contextSentence?: string | null;
  drillAnswerSets?: VocabularyDrillAnswerSetMap | null;
  coreMeaning?: string | null;
  definition?: string | null;
  translationWord?: string | null;
  translationMeaning?: string | null;
  synonyms?: string[] | null;
  antonyms?: string[] | null;
  exampleSentence?: string | null;
  exampleTranslation?: string | null;
  audioText?: string | null;
  partOfSpeech?: string | null;
  alternateDefinitions?: string[] | null;
  synonymCandidates?: string[] | null;
  antonymCandidates?: string[] | null;
  exampleSentences?: string[] | null;
};

function normalizeWhitespace(text: string) {
  return text.trim().replace(/\s+/g, " ");
}

function normalizeNullableText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = normalizeWhitespace(value);
  return normalized || null;
}

function normalizeComparableText(value: string | null | undefined) {
  return normalizeNullableText(value)?.toLowerCase() ?? "";
}

function sanitizeTextArray(values: Array<string | null | undefined>, limit?: number) {
  const deduped = new Map<string, string>();

  for (const value of values) {
    const normalized = normalizeNullableText(value);
    if (!normalized) {
      continue;
    }

    const compareKey = normalized.toLowerCase();
    if (deduped.has(compareKey)) {
      continue;
    }

    deduped.set(compareKey, normalized);
  }

  const nextValues = Array.from(deduped.values());
  return typeof limit === "number" ? nextValues.slice(0, limit) : nextValues;
}

function countTokens(text: string | null | undefined) {
  const normalized = normalizeNullableText(text);
  return normalized ? normalized.split(/\s+/).filter(Boolean).length : 0;
}

function getAnswerSetMeta(input: ResolveSafeVocabularyDrillContentInput) {
  const meta = input.drillAnswerSets?.__meta__;
  if (!meta || typeof meta !== "object") {
    return null;
  }

  return meta;
}

function getStrongStoredTranslationWord(input: ResolveSafeVocabularyDrillContentInput) {
  const candidate = normalizeNullableText(
    input.drillAnswerSets?.translation_english_to_native?.drill_correct_answer ?? null
  );

  if (!candidate) {
    return null;
  }

  const compareCandidate = normalizeComparableText(candidate);
  const compareWord = normalizeComparableText(input.itemText);
  const compareMeaning = normalizeComparableText(input.englishExplanation);

  if (!compareCandidate || compareCandidate === compareWord || compareCandidate === compareMeaning) {
    return null;
  }

  if (countTokens(candidate) > 3) {
    return null;
  }

  return candidate;
}

function deriveCoreMeaning(input: ResolveSafeVocabularyDrillContentInput) {
  const meta = getAnswerSetMeta(input);
  const candidates = [
    input.coreMeaning,
    meta?.refined_definition ?? null,
    meta?.alternate_definitions?.[0] ?? null,
    input.alternateDefinitions?.[0] ?? null,
    input.englishExplanation,
  ];

  return (
    sanitizeTextArray(candidates, 8).find(
      (candidate) =>
        !isPlaceholderVocabularyDefinition({
          itemText: input.itemText,
          englishExplanation: candidate,
        })
    ) ?? null
  );
}

function deriveDefinition(input: ResolveSafeVocabularyDrillContentInput, coreMeaning: string | null) {
  return (
    sanitizeTextArray(
      [
        input.definition,
        input.englishExplanation,
        coreMeaning,
      ],
      1
    )[0] ?? null
  );
}

function deriveTranslationWord(input: ResolveSafeVocabularyDrillContentInput) {
  return (
    sanitizeTextArray(
      [
        countTokens(input.translationWord) <= 3 &&
        !isPlaceholderVocabularyTranslation({
          itemText: input.itemText,
          translatedExplanation: input.translationWord,
        })
          ? input.translationWord
          : null,
        getStrongStoredTranslationWord(input),
      ],
      1
    )[0] ?? null
  );
}

function deriveTranslationMeaning(input: ResolveSafeVocabularyDrillContentInput) {
  return (
    sanitizeTextArray(
      [
        !isPlaceholderVocabularyTranslation({
          itemText: input.itemText,
          translatedExplanation: input.translationMeaning,
        })
          ? input.translationMeaning
          : null,
        !isPlaceholderVocabularyTranslation({
          itemText: input.itemText,
          translatedExplanation: input.translatedExplanation,
        })
          ? input.translatedExplanation
          : null,
      ],
      1
    )[0] ?? null
  );
}

function deriveExampleSentence(input: ResolveSafeVocabularyDrillContentInput) {
  const meta = getAnswerSetMeta(input);
  return (
    sanitizeTextArray(
      [
        input.exampleSentence,
        meta?.practice_example_sentence ?? null,
        input.exampleText,
        input.exampleSentences?.[0] ?? null,
        input.contextSentence,
      ],
      1
    )[0] ?? null
  );
}

function derivePartOfSpeech(input: ResolveSafeVocabularyDrillContentInput) {
  const explicit = normalizeNullableText(input.partOfSpeech);
  if (explicit) {
    return explicit;
  }

  if (input.itemType === "phrase" || input.itemText.includes(" ")) {
    return "phrase";
  }

  const answerSetPriority: VocabularyDrillAnswerSetKey[] = [
    "translation_native_to_english",
    "collocation",
    "context_meaning",
    "synonym",
    "translation_english_to_native",
  ];

  for (const key of answerSetPriority) {
    const normalization = input.drillAnswerSets?.[key]?.normalization;
    const inferred = normalizeNullableText(normalization?.part_of_speech ?? null);
    if (inferred && inferred !== "unknown") {
      return inferred;
    }
  }

  return null;
}

export function resolveSafeVocabularyDrillContent(
  input: ResolveSafeVocabularyDrillContentInput
): VocabularyGoldContentFields {
  const normalizedItemText = normalizeNullableText(input.itemText) ?? "";
  const coreMeaning = deriveCoreMeaning(input);
  const definition = deriveDefinition(input, coreMeaning);

  return {
    coreMeaning,
    definition,
    translationWord: deriveTranslationWord(input),
    translationMeaning: deriveTranslationMeaning(input),
    synonyms: sanitizeTextArray(
      [
        ...(input.synonyms ?? []),
        ...(input.synonymCandidates ?? []),
      ],
      8
    ),
    antonyms: sanitizeTextArray(
      [
        ...(input.antonyms ?? []),
        ...(input.antonymCandidates ?? []),
      ],
      6
    ),
    exampleSentence: deriveExampleSentence(input),
    exampleTranslation: normalizeNullableText(input.exampleTranslation),
    audioText: normalizeNullableText(input.audioText) ?? normalizedItemText,
    partOfSpeech: derivePartOfSpeech(input),
  };
}
