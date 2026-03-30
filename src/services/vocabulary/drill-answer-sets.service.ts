import { generateVocabularyDrillAnswerSets } from "@/services/ai/generate-vocabulary-drill-answer-sets";
import type {
  VocabularyAnswerDifficultyBand,
  VocabularyAnswerPartOfSpeech,
  VocabularyAnswerStyle,
  VocabularyDrillAnswerNormalization,
  VocabularyDrillAnswerSet,
  VocabularyDrillAnswerSetKey,
  VocabularyDrillAnswerSetMap,
} from "@/types/vocabulary-answer-sets";

type PrepareVocabularyDrillAnswerSetsInput = {
  itemText: string;
  itemType: "word" | "phrase";
  englishExplanation: string;
  translatedExplanation?: string | null;
  contextSentence?: string | null;
  exampleText?: string | null;
  existingAnswerSets?: VocabularyDrillAnswerSetMap | null;
  meaningFallbackPool?: string[];
  translationFallbackPool?: string[];
  lexicalFallbackPool?: string[];
};

type AnswerProfile = {
  normalized: string;
  tokenCount: number;
  characterLength: number;
  partOfSpeech: VocabularyAnswerPartOfSpeech;
  difficultyBand: VocabularyAnswerDifficultyBand;
  style: VocabularyAnswerStyle;
};

type AuditVocabularyDrillAnswerSetParams = {
  drillType: VocabularyDrillAnswerSetKey;
  answerSet: Partial<VocabularyDrillAnswerSet> | null | undefined;
  fallbackCorrectAnswer: string;
  flashcardDefinition: string;
  itemType: "word" | "phrase";
};

type DrillAnswerSetAudit = {
  normalizedAnswerSet: VocabularyDrillAnswerSet;
  issues: string[];
  needsRefinement: boolean;
};

const MINIMUM_DISTRACTOR_COUNT = 3;
const GENERIC_DISTRACTOR_SET = new Set([
  "thing",
  "something",
  "someone",
  "somebody",
  "person",
  "object",
  "place",
  "good",
  "bad",
  "nice",
  "stuff",
  "very good",
  "very bad",
]);
const FUNCTION_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "in",
  "into",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);
const DEFINITION_BASED_DRILL_TYPES = new Set<VocabularyDrillAnswerSetKey>([
  "synonym",
  "context_meaning",
]);
const DRILL_ANSWER_SET_KEYS: VocabularyDrillAnswerSetKey[] = [
  "translation_english_to_native",
  "translation_native_to_english",
  "synonym",
  "context_meaning",
  "collocation",
];

function normalizeWhitespace(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeOptionStyle(text: string, reference: string) {
  const collapsed = normalizeWhitespace(text).replace(/[.!?;:,]+$/g, "");
  if (!collapsed) {
    return "";
  }

  const referenceStartsUppercase = /^[A-Z]/.test(reference.trim());
  if (!referenceStartsUppercase) {
    return collapsed.charAt(0).toLowerCase() + collapsed.slice(1);
  }

  return collapsed.charAt(0).toUpperCase() + collapsed.slice(1);
}

function normalizeForCompare(text: string) {
  return normalizeWhitespace(text)
    .replace(/[.!?;:,]+$/g, "")
    .toLowerCase();
}

function countTokens(text: string) {
  return normalizeWhitespace(text).split(/\s+/).filter(Boolean).length;
}

function extractContentTokens(text: string) {
  return normalizeForCompare(text)
    .split(/[^a-z0-9'-]+/)
    .filter((token) => token && !FUNCTION_WORDS.has(token));
}

function inferPartOfSpeech(text: string): VocabularyAnswerPartOfSpeech {
  const normalized = normalizeForCompare(text);
  if (!normalized) {
    return "unknown";
  }

  if (normalized.startsWith("to ")) {
    return "verb";
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);
  const firstToken = tokens[0] ?? "";
  const singleToken = tokens.length === 1 ? tokens[0] ?? "" : "";

  if (tokens.length >= 3) {
    return "phrase";
  }

  if (/(ly)$/.test(singleToken)) {
    return "adverb";
  }

  if (
    /(?:tion|sion|ment|ness|ity|ism|ship|ance|ence|acy|ure|dom|hood|er|or)$/.test(singleToken) ||
    /^(a|an|the|someone|somebody|something)$/.test(firstToken)
  ) {
    return "noun";
  }

  if (/(?:ous|ful|less|able|ible|al|ary|ory|ive|ic|ical|ish)$/.test(singleToken)) {
    return "adjective";
  }

  if (/(?:ate|ify|ise|ize|en)$/.test(singleToken)) {
    return "verb";
  }

  if (tokens.length === 2 && /^(very|more|most|less|least)$/.test(firstToken)) {
    return "adjective";
  }

  if (tokens.length === 2) {
    return "phrase";
  }

  return "unknown";
}

function inferDifficultyBand(text: string): VocabularyAnswerDifficultyBand {
  const normalized = normalizeWhitespace(text);
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const averageTokenLength =
    tokens.length > 0
      ? tokens.reduce((sum, token) => sum + token.length, 0) / tokens.length
      : normalized.length;

  if (tokens.length >= 4 || averageTokenLength >= 8) {
    return "hard";
  }

  if (tokens.length >= 2 || averageTokenLength >= 5.5) {
    return "medium";
  }

  return "easy";
}

function inferStyle(text: string): VocabularyAnswerStyle {
  const normalized = normalizeWhitespace(text);
  const tokens = normalized.split(/\s+/).filter(Boolean);

  if (tokens.length <= 1) {
    return "single_word";
  }

  if (/^to\s+/i.test(normalized)) {
    return "infinitive";
  }

  if (tokens.length >= 5) {
    return "clause_like";
  }

  return "short_phrase";
}

function buildAnswerProfile(text: string): AnswerProfile {
  const normalized = normalizeWhitespace(text);

  return {
    normalized,
    tokenCount: countTokens(normalized),
    characterLength: normalized.length,
    partOfSpeech: inferPartOfSpeech(normalized),
    difficultyBand: inferDifficultyBand(normalized),
    style: inferStyle(normalized),
  };
}

function isGenericDistractor(text: string) {
  return GENERIC_DISTRACTOR_SET.has(normalizeForCompare(text));
}

function looksLikeOppositeMarker(text: string) {
  const normalized = normalizeForCompare(text);
  return (
    normalized.startsWith("not ") ||
    normalized.startsWith("opposite ") ||
    normalized.startsWith("the opposite") ||
    normalized.includes(" opposite of ")
  );
}

function isTooCloseToCorrect(candidate: string, correctAnswer: string) {
  const normalizedCandidate = normalizeForCompare(candidate);
  const normalizedCorrect = normalizeForCompare(correctAnswer);

  if (!normalizedCandidate || !normalizedCorrect) {
    return true;
  }

  if (normalizedCandidate === normalizedCorrect) {
    return true;
  }

  return (
    normalizedCandidate.includes(normalizedCorrect) ||
    normalizedCorrect.includes(normalizedCandidate)
  );
}

function hasCompatiblePartOfSpeech(candidate: AnswerProfile, correct: AnswerProfile) {
  if (correct.partOfSpeech === "unknown" || candidate.partOfSpeech === "unknown") {
    return true;
  }

  if (correct.partOfSpeech === "phrase" || candidate.partOfSpeech === "phrase") {
    return correct.partOfSpeech === candidate.partOfSpeech;
  }

  return correct.partOfSpeech === candidate.partOfSpeech;
}

function hasCompatibleStyle(candidate: AnswerProfile, correct: AnswerProfile) {
  if (candidate.style === correct.style) {
    return true;
  }

  if (
    (candidate.style === "short_phrase" && correct.style === "clause_like") ||
    (candidate.style === "clause_like" && correct.style === "short_phrase")
  ) {
    return false;
  }

  return (
    candidate.style !== "single_word" &&
    correct.style !== "single_word" &&
    candidate.style !== "infinitive" &&
    correct.style !== "infinitive"
  );
}

function hasCompatibleDifficulty(candidate: AnswerProfile, correct: AnswerProfile) {
  const bands: VocabularyAnswerDifficultyBand[] = ["easy", "medium", "hard"];
  const candidateIndex = bands.indexOf(candidate.difficultyBand);
  const correctIndex = bands.indexOf(correct.difficultyBand);
  return Math.abs(candidateIndex - correctIndex) <= 1;
}

function sharesTooMuchDefinitionWording(
  candidate: string,
  flashcardDefinition: string,
  drillType: VocabularyDrillAnswerSetKey
) {
  if (!DEFINITION_BASED_DRILL_TYPES.has(drillType)) {
    return false;
  }

  const definitionTokens = new Set(extractContentTokens(flashcardDefinition));
  const candidateTokens = extractContentTokens(candidate);

  if (definitionTokens.size === 0 || candidateTokens.length === 0) {
    return false;
  }

  const sharedCount = candidateTokens.filter((token) => definitionTokens.has(token)).length;
  return sharedCount >= Math.max(2, Math.ceil(candidateTokens.length * 0.6));
}

function differsEnoughFromDefinition(
  candidate: string,
  flashcardDefinition: string,
  drillType: VocabularyDrillAnswerSetKey
) {
  if (!DEFINITION_BASED_DRILL_TYPES.has(drillType)) {
    return true;
  }

  const normalizedCandidate = normalizeForCompare(candidate);
  const normalizedDefinition = normalizeForCompare(flashcardDefinition);

  if (!normalizedCandidate || !normalizedDefinition) {
    return true;
  }

  if (normalizedCandidate === normalizedDefinition) {
    return false;
  }

  return !sharesTooMuchDefinitionWording(candidate, flashcardDefinition, drillType);
}

function scoreCandidate(candidate: AnswerProfile, correct: AnswerProfile) {
  const lengthRatio =
    correct.characterLength > 0
      ? Math.min(candidate.characterLength, correct.characterLength) /
        Math.max(candidate.characterLength, correct.characterLength)
      : 0;

  let score = 0;

  if (Math.abs(candidate.tokenCount - correct.tokenCount) <= 1) {
    score += 4;
  } else if (Math.abs(candidate.tokenCount - correct.tokenCount) === 2) {
    score += 1;
  } else {
    score -= 3;
  }

  if (lengthRatio >= 0.65) {
    score += 4;
  } else if (lengthRatio >= 0.5) {
    score += 2;
  } else {
    score -= 3;
  }

  if (hasCompatiblePartOfSpeech(candidate, correct)) {
    score += 6;
  } else {
    score -= 6;
  }

  if (hasCompatibleDifficulty(candidate, correct)) {
    score += 3;
  } else {
    score -= 2;
  }

  if (hasCompatibleStyle(candidate, correct)) {
    score += 3;
  } else {
    score -= 3;
  }

  return score;
}

function buildNormalization(text: string): VocabularyDrillAnswerNormalization {
  const profile = buildAnswerProfile(text);

  return {
    part_of_speech: profile.partOfSpeech,
    difficulty_band: profile.difficultyBand,
    style: profile.style,
    token_count: profile.tokenCount,
    character_length: profile.characterLength,
  };
}

function finalizeDistractorSet(params: {
  drillType: VocabularyDrillAnswerSetKey;
  correctAnswer: string;
  flashcardDefinition: string;
  candidates: string[];
}) {
  const correctProfile = buildAnswerProfile(params.correctAnswer);
  const deduped = new Map<
    string,
    {
      value: string;
      score: number;
    }
  >();

  for (const rawCandidate of params.candidates) {
    const normalizedValue = normalizeOptionStyle(rawCandidate, params.correctAnswer);
    const compareKey = normalizeForCompare(normalizedValue);

    if (!normalizedValue || !compareKey) {
      continue;
    }

    if (isTooCloseToCorrect(normalizedValue, params.correctAnswer)) {
      continue;
    }

    if (isGenericDistractor(normalizedValue)) {
      continue;
    }

    if (looksLikeOppositeMarker(normalizedValue)) {
      continue;
    }

    if (sharesTooMuchDefinitionWording(normalizedValue, params.flashcardDefinition, params.drillType)) {
      continue;
    }

    const candidateProfile = buildAnswerProfile(normalizedValue);
    const score = scoreCandidate(candidateProfile, correctProfile);
    const existing = deduped.get(compareKey);

    if (!existing || score > existing.score) {
      deduped.set(compareKey, {
        value: normalizedValue,
        score,
      });
    }
  }

  return Array.from(deduped.values())
    .sort((left, right) => right.score - left.score)
    .map((item) => item.value);
}

function buildFallbackAnswerSet(params: {
  drillType: VocabularyDrillAnswerSetKey;
  input: PrepareVocabularyDrillAnswerSetsInput;
}) {
  const { drillType, input } = params;

  if (drillType === "translation_english_to_native") {
    const correctAnswer =
      normalizeWhitespace(input.translatedExplanation ?? "") ||
      normalizeWhitespace(input.englishExplanation);

    return {
      drill_type: drillType,
      drill_correct_answer: correctAnswer,
      distractors: finalizeDistractorSet({
        drillType,
        correctAnswer,
        flashcardDefinition: input.englishExplanation,
        candidates: input.translationFallbackPool ?? [],
      }).slice(0, 4),
      normalization: buildNormalization(correctAnswer),
    } satisfies VocabularyDrillAnswerSet;
  }

  if (drillType === "translation_native_to_english") {
    const correctAnswer = normalizeWhitespace(input.itemText);

    return {
      drill_type: drillType,
      drill_correct_answer: correctAnswer,
      distractors: finalizeDistractorSet({
        drillType,
        correctAnswer,
        flashcardDefinition: input.englishExplanation,
        candidates: input.lexicalFallbackPool ?? [],
      }).slice(0, 4),
      normalization: buildNormalization(correctAnswer),
    } satisfies VocabularyDrillAnswerSet;
  }

  if (drillType === "collocation") {
    const correctAnswer = normalizeWhitespace(input.itemText);

    return {
      drill_type: drillType,
      drill_correct_answer: correctAnswer,
      distractors: finalizeDistractorSet({
        drillType,
        correctAnswer,
        flashcardDefinition: input.englishExplanation,
        candidates: input.lexicalFallbackPool ?? [],
      }).slice(0, 4),
      normalization: buildNormalization(correctAnswer),
    } satisfies VocabularyDrillAnswerSet;
  }

  const correctAnswer = normalizeWhitespace(input.englishExplanation);

  return {
    drill_type: drillType,
    drill_correct_answer: correctAnswer,
    distractors: finalizeDistractorSet({
      drillType,
      correctAnswer,
      flashcardDefinition: input.englishExplanation,
      candidates: input.meaningFallbackPool ?? [],
    }).slice(0, 4),
    normalization: buildNormalization(correctAnswer),
  } satisfies VocabularyDrillAnswerSet;
}

function buildEmptyAnswerSet(
  drillType: VocabularyDrillAnswerSetKey,
  fallbackCorrectAnswer: string
): VocabularyDrillAnswerSet {
  const correctAnswer = normalizeWhitespace(fallbackCorrectAnswer);

  return {
    drill_type: drillType,
    drill_correct_answer: correctAnswer,
    distractors: [],
    normalization: buildNormalization(correctAnswer),
  };
}

export function auditVocabularyDrillAnswerSet(
  params: AuditVocabularyDrillAnswerSetParams
): DrillAnswerSetAudit {
  const source = params.answerSet;
  const correctAnswer =
    normalizeWhitespace(source?.drill_correct_answer ?? "") ||
    normalizeWhitespace(params.fallbackCorrectAnswer);
  const distractors = Array.isArray(source?.distractors) ? source?.distractors ?? [] : [];
  const issues: string[] = [];

  if (!correctAnswer) {
    issues.push("missing_correct_answer");
    return {
      normalizedAnswerSet: buildEmptyAnswerSet(params.drillType, params.fallbackCorrectAnswer),
      issues,
      needsRefinement: true,
    };
  }

  if (
    !differsEnoughFromDefinition(
      correctAnswer,
      params.flashcardDefinition,
      params.drillType
    )
  ) {
    issues.push("correct_answer_too_close_to_flashcard_definition");
  }

  const normalizedDistractors = finalizeDistractorSet({
    drillType: params.drillType,
    correctAnswer,
    flashcardDefinition: params.flashcardDefinition,
    candidates: distractors,
  }).slice(0, 4);

  if (distractors.length < MINIMUM_DISTRACTOR_COUNT) {
    issues.push("too_few_distractors");
  }

  if (normalizedDistractors.length < MINIMUM_DISTRACTOR_COUNT) {
    issues.push("insufficient_quality_distractors");
  }

  if (distractors.some((candidate) => isTooCloseToCorrect(candidate, correctAnswer))) {
    issues.push("contains_correct_or_near_duplicate");
  }

  if (distractors.some(isGenericDistractor)) {
    issues.push("contains_generic_distractor");
  }

  if (distractors.some(looksLikeOppositeMarker)) {
    issues.push("contains_obvious_opposite_marker");
  }

  if (
    distractors.some((candidate) =>
      sharesTooMuchDefinitionWording(candidate, params.flashcardDefinition, params.drillType)
    )
  ) {
    issues.push("distractors_too_close_to_flashcard_definition");
  }

  const dedupedInput = new Set(distractors.map((item) => normalizeForCompare(item)).filter(Boolean));
  if (dedupedInput.size !== distractors.length) {
    issues.push("contains_duplicates");
  }

  return {
    normalizedAnswerSet: {
      drill_type: params.drillType,
      drill_correct_answer: correctAnswer,
      distractors: normalizedDistractors,
      normalization: buildNormalization(correctAnswer),
    },
    issues,
    needsRefinement: issues.length > 0,
  };
}

function sanitizeStoredAnswerSets(value: unknown): VocabularyDrillAnswerSetMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const input = value as Record<string, unknown>;
  const result: VocabularyDrillAnswerSetMap = {};

  for (const drillType of DRILL_ANSWER_SET_KEYS) {
    const raw = input[drillType];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      continue;
    }

    const rawRecord = raw as Record<string, unknown>;
    const distractors = Array.isArray(rawRecord.distractors)
      ? rawRecord.distractors.filter((candidate): candidate is string => typeof candidate === "string")
      : [];
    const correctAnswer =
      typeof rawRecord.drill_correct_answer === "string" ? rawRecord.drill_correct_answer : "";

    if (!correctAnswer) {
      continue;
    }

    result[drillType] = {
      drill_type: drillType,
      drill_correct_answer: correctAnswer,
      distractors,
      normalization: buildNormalization(correctAnswer),
    };
  }

  return result;
}

function getFallbackCorrectAnswer(
  drillType: VocabularyDrillAnswerSetKey,
  input: PrepareVocabularyDrillAnswerSetsInput
) {
  switch (drillType) {
    case "translation_english_to_native":
      return input.translatedExplanation ?? input.englishExplanation;
    case "translation_native_to_english":
    case "collocation":
      return input.itemText;
    case "synonym":
    case "context_meaning":
    default:
      return input.englishExplanation;
  }
}

export function parseVocabularyDrillAnswerSets(value: unknown) {
  return sanitizeStoredAnswerSets(value);
}

export function hasReadyVocabularyDrillAnswerSets(value: unknown) {
  const stored = sanitizeStoredAnswerSets(value);

  return DRILL_ANSWER_SET_KEYS.every((drillType) => {
    const answerSet = stored[drillType];
    return Boolean(
      answerSet?.drill_correct_answer &&
        Array.isArray(answerSet.distractors) &&
        answerSet.distractors.length >= MINIMUM_DISTRACTOR_COUNT
    );
  });
}

export async function prepareVocabularyDrillAnswerSets(
  input: PrepareVocabularyDrillAnswerSetsInput
) {
  const storedAnswerSets = sanitizeStoredAnswerSets(input.existingAnswerSets);
  const preparedFromStored: VocabularyDrillAnswerSetMap = {};
  const missingOrWeak = new Set<VocabularyDrillAnswerSetKey>();

  for (const drillType of DRILL_ANSWER_SET_KEYS) {
    const audit = auditVocabularyDrillAnswerSet({
      drillType,
      answerSet: storedAnswerSets[drillType],
      fallbackCorrectAnswer: getFallbackCorrectAnswer(drillType, input),
      flashcardDefinition: input.englishExplanation,
      itemType: input.itemType,
    });

    preparedFromStored[drillType] = audit.normalizedAnswerSet;

    if (audit.needsRefinement) {
      missingOrWeak.add(drillType);
    }
  }

  if (missingOrWeak.size === 0) {
    return preparedFromStored;
  }

  let aiAnswerSets: VocabularyDrillAnswerSetMap = {};

  try {
    const generated = await generateVocabularyDrillAnswerSets({
      itemText: input.itemText,
      itemType: input.itemType,
      englishExplanation: input.englishExplanation,
      translatedExplanation: input.translatedExplanation ?? null,
      contextSentence: input.contextSentence ?? null,
      exampleText: input.exampleText ?? null,
      meaningFallbackPool: input.meaningFallbackPool ?? [],
      translationFallbackPool: input.translationFallbackPool ?? [],
      lexicalFallbackPool: input.lexicalFallbackPool ?? [],
      existingAnswerSets: storedAnswerSets,
    });

    aiAnswerSets = sanitizeStoredAnswerSets(generated);
  } catch (error) {
    console.error("prepareVocabularyDrillAnswerSets ai generation failed", error);
  }

  const result: VocabularyDrillAnswerSetMap = {};

  for (const drillType of DRILL_ANSWER_SET_KEYS) {
    const fallbackAnswerSet = buildFallbackAnswerSet({
      drillType,
      input,
    });
    const audit = auditVocabularyDrillAnswerSet({
      drillType,
      answerSet:
        aiAnswerSets[drillType] ??
        storedAnswerSets[drillType] ??
        fallbackAnswerSet,
      fallbackCorrectAnswer: fallbackAnswerSet.drill_correct_answer,
      flashcardDefinition: input.englishExplanation,
      itemType: input.itemType,
    });

    const mergedDistractors = finalizeDistractorSet({
      drillType,
      correctAnswer: audit.normalizedAnswerSet.drill_correct_answer,
      flashcardDefinition: input.englishExplanation,
      candidates: [
        ...(audit.normalizedAnswerSet.distractors ?? []),
        ...(storedAnswerSets[drillType]?.distractors ?? []),
        ...(fallbackAnswerSet.distractors ?? []),
      ],
    }).slice(0, 4);

    result[drillType] = {
      ...audit.normalizedAnswerSet,
      distractors: mergedDistractors,
    };
  }

  return result;
}
