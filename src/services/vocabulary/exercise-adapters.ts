import type {
  CollocationVocabExercise,
  ErrorDetectionVocabExercise,
  FillBlankVocabExercise,
  MeaningMatchVocabExercise,
  PairMatchVocabExercise,
  SentenceBuilderVocabExercise,
  SupportedVocabExercise,
  SynonymVocabExercise,
  TranslationMatchVocabExercise,
} from "@/types/vocab-exercises";
import type {
  VocabularyDrillAnswerSet,
  VocabularyDrillAnswerSetKey,
  VocabularyDrillAnswerSetMap,
  VocabularyDrillAnswerNormalization,
  VocabularyDrillAnswerSetMeta,
} from "@/types/vocabulary-answer-sets";

export type MeaningDrillItem = {
  wordProgressId: string;
  vocabularyItemId: string;
  itemText: string;
  itemType: "word" | "phrase";
  correctAnswer: string;
  distractors: string[];
  answerSets?: VocabularyDrillAnswerSetMap;
  plainMeaning?: string;
  translatedExplanation?: string | null;
  translationLanguage?: string | null;
  contextSentence?: string;
  exampleText?: string;
  audioUrl?: string | null;
  audioStatus?: "ready" | "pending" | "failed" | "missing" | null;
  sourceLessonId?: string | null;
  sourceLessonTitle?: string | null;
  sourcePassageTitle?: string | null;
  sourceContextSnippet?: string | null;
  sourceCapturedAt?: string | null;
  sourceType?: "reading_lesson" | "generated_lesson" | "other" | null;
};

export type ClozeDrillItem = {
  wordProgressId: string;
  vocabularyItemId: string;
  itemText: string;
  itemType: "word" | "phrase";
  contextSentence: string;
  correctAnswer: string;
  distractors: string[];
  answerSets?: VocabularyDrillAnswerSetMap;
  plainMeaning?: string;
  translatedExplanation?: string | null;
  translationLanguage?: string | null;
  exampleText?: string;
  audioUrl?: string | null;
  audioStatus?: "ready" | "pending" | "failed" | "missing" | null;
  sourceLessonId?: string | null;
  sourceLessonTitle?: string | null;
  sourcePassageTitle?: string | null;
  sourceContextSnippet?: string | null;
  sourceCapturedAt?: string | null;
  sourceType?: "reading_lesson" | "generated_lesson" | "other" | null;
};

function buildSourceReviewMeta(item: MeaningDrillItem | ClozeDrillItem) {
  return {
    sourceLessonId: item.sourceLessonId ?? null,
    sourceLessonTitle: item.sourceLessonTitle ?? null,
    sourcePassageTitle: item.sourcePassageTitle ?? null,
    sourceContextSnippet:
      item.sourceContextSnippet ?? getSourceSentence(item) ?? null,
    sourceCapturedAt: item.sourceCapturedAt ?? null,
    sourceType: item.sourceType ?? (item.sourceLessonId ? "reading_lesson" : "other"),
    sourceOrigin: item.sourceLessonId ? "lesson_capture" as const : "unknown" as const,
  };
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function makeBlank(sentence: string, itemText: string) {
  const pattern = new RegExp(escapeRegExp(itemText), "i");
  if (pattern.test(sentence)) {
    return sentence.replace(pattern, "_____");
  }
  return `_____ — ${sentence}`;
}

function getPlainMeaning(item: MeaningDrillItem | ClozeDrillItem) {
  return item.plainMeaning ?? item.correctAnswer;
}

function getTranslatedMeaning(item: MeaningDrillItem | ClozeDrillItem) {
  return item.translatedExplanation?.trim() ?? null;
}

function normalizeTranslationLabel(text: string) {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^[`"'“”«»„]+/, "")
    .replace(/[`"'“”«»„]+$/g, "");
}

function getExpectedTranslationScript(item: MeaningDrillItem | ClozeDrillItem) {
  const language = item.translationLanguage?.trim().toLowerCase() ?? "";

  if (
    language === "ru" ||
    language.startsWith("ru-") ||
    language === "uk" ||
    language.startsWith("uk-") ||
    language === "bg" ||
    language.startsWith("bg-") ||
    language === "mk" ||
    language.startsWith("mk-")
  ) {
    return "cyrillic" as const;
  }

  return null;
}

function scoreNativeTranslationCandidate(
  candidate: string | null | undefined,
  item: MeaningDrillItem | ClozeDrillItem
) {
  const normalized = normalizeTranslationLabel(candidate ?? "");
  if (!normalized) {
    return null;
  }

  const normalizedCandidate = normalizePairSideText(normalized);
  const normalizedWord = normalizePairSideText(item.itemText);
  const normalizedMeaning = normalizePairSideText(getPlainMeaning(item));

  if (
    !normalizedCandidate ||
    normalizedCandidate === normalizedWord ||
    normalizedCandidate === normalizedMeaning
  ) {
    return null;
  }

  const tokenCount = countTokens(normalized);
  if (tokenCount > 8) {
    return null;
  }

  const expectedScript = getExpectedTranslationScript(item);
  const actualScript = inferScriptProfile(normalized);
  let score = 0;

  if (tokenCount <= 4) {
    score += 4;
  } else if (tokenCount <= 6) {
    score += 2;
  }

  if (/[A-Za-zА-Яа-яЁё]/.test(normalized)) {
    score += 2;
  }

  if (expectedScript) {
    if (actualScript === expectedScript) {
      score += 10;
    } else if (actualScript === "latin") {
      score -= 8;
    } else if (actualScript !== "other") {
      score -= 4;
    }
  } else if (actualScript !== "other") {
    score += 1;
  }

  if (/^[\W_]+$/.test(normalized)) {
    return null;
  }

  if (/[{}[\]|<>]/.test(normalized)) {
    score -= 8;
  }

  return {
    value: normalized,
    score,
  };
}

function getStoredNativeTranslation(item: MeaningDrillItem | ClozeDrillItem) {
  const value = getStoredAnswerSet(item, "translation_english_to_native")?.drill_correct_answer;
  return value ? normalizeTranslationLabel(value) : null;
}

function getPreferredNativeTranslation(item: MeaningDrillItem | ClozeDrillItem) {
  const candidates = [
    scoreNativeTranslationCandidate(getStoredNativeTranslation(item), item),
    scoreNativeTranslationCandidate(getTranslatedMeaning(item), item),
  ]
    .filter((candidate): candidate is { value: string; score: number } => Boolean(candidate))
    .sort((left, right) => right.score - left.score);

  return candidates[0]?.value ?? null;
}

function hasUsableNativeTranslation(item: MeaningDrillItem | ClozeDrillItem) {
  return Boolean(getPreferredNativeTranslation(item));
}

function getSourceSentence(item: MeaningDrillItem | ClozeDrillItem) {
  return item.contextSentence || item.exampleText || "";
}

function uniqueNonEmpty(items: Array<string | null | undefined>) {
  return Array.from(
    new Set(items.map((item) => item?.trim()).filter((item): item is string => Boolean(item)))
  );
}

function getLexicalDistractorCandidates(
  item: MeaningDrillItem | ClozeDrillItem,
  allItems: Array<MeaningDrillItem | ClozeDrillItem>
) {
  const targetTokenCount = countTokens(item.itemText);
  const targetLength = item.itemText.trim().length;

  return uniqueNonEmpty(
    allItems
      .filter((candidate) => candidate.vocabularyItemId !== item.vocabularyItemId)
      .map((candidate) => candidate.itemText)
  )
    .filter((candidate) => candidate.toLowerCase() !== item.itemText.toLowerCase())
    .map((candidate) => {
      const candidateTokenCount = countTokens(candidate);
      const candidateLength = candidate.trim().length;
      let score = 0;

      if (Math.abs(candidateTokenCount - targetTokenCount) <= 1) {
        score += 4;
      }

      if (Math.abs(candidateLength - targetLength) <= Math.max(4, Math.round(targetLength * 0.35))) {
        score += 3;
      }

      if (item.itemType === "phrase" && candidateTokenCount >= 2) {
        score += 2;
      }

      if (item.itemType === "word" && candidateTokenCount === 1) {
        score += 2;
      }

      return {
        candidate,
        score,
      };
    })
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.candidate);
}

function countTokens(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function normalizeSentence(text: string) {
  return text.trim().replace(/\s+/g, " ");
}

function isUsableGeneratedPracticeSentence(
  sentence: string | null | undefined,
  itemText: string
) {
  const normalized = normalizeSentence(sentence ?? "");

  if (!normalized) {
    return false;
  }

  if (
    normalized.startsWith('Context with "') ||
    normalized.startsWith('Example with "') ||
    normalized.startsWith('Meaning of "')
  ) {
    return false;
  }

  if (countTokens(normalized) < 5 || normalized.length < 24) {
    return false;
  }

  if (!/[.!?]$/.test(normalized)) {
    return false;
  }

  return new RegExp(`\\b${escapeRegExp(itemText)}\\b`, "i").test(normalized);
}

function getAiBackedPracticeSentence(item: MeaningDrillItem | ClozeDrillItem) {
  return isUsableGeneratedPracticeSentence(item.exampleText, item.itemText)
    ? normalizeSentence(item.exampleText)
    : null;
}

function getStoredPracticeExampleSentence(item: MeaningDrillItem | ClozeDrillItem) {
  return getStoredAnswerSetMeta(item)?.practice_example_sentence?.trim() || null;
}

function getPreferredPracticeSentence(item: MeaningDrillItem | ClozeDrillItem) {
  const storedPracticeSentence = getStoredPracticeExampleSentence(item);

  if (isUsableGeneratedPracticeSentence(storedPracticeSentence, item.itemText)) {
    return {
      sentence: normalizeSentence(storedPracticeSentence),
      source: "stored_practice_example" as const,
    };
  }

  const aiSentence = getAiBackedPracticeSentence(item);

  return {
    sentence: aiSentence,
    source: aiSentence ? ("ai_example_text" as const) : ("none" as const),
  };
}

function shuffleBySeed<T>(items: T[], seedText: string) {
  const copy = [...items];
  let seed = 0;

  for (let index = 0; index < seedText.length; index += 1) {
    seed = (seed * 31 + seedText.charCodeAt(index)) >>> 0;
  }

  function nextRandom() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967295;
  }

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(nextRandom() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function buildMeaningOptions(
  item: MeaningDrillItem | ClozeDrillItem,
  optionPrefix: string
) {
  return shuffle([
    { id: "correct", label: getPlainMeaning(item) },
    ...uniqueNonEmpty(item.distractors ?? []).slice(0, 3).map((label, index) => ({
      id: `${optionPrefix}-${index}`,
      label,
    })),
  ]);
}

function getStoredAnswerSet(
  item: MeaningDrillItem | ClozeDrillItem,
  drillType: VocabularyDrillAnswerSetKey
) {
  return item.answerSets?.[drillType] ?? null;
}

function getStoredAnswerSetMeta(item: MeaningDrillItem | ClozeDrillItem) {
  const meta = item.answerSets?.__meta__;

  if (!meta || typeof meta !== "object") {
    return null;
  }

  return meta as VocabularyDrillAnswerSetMeta;
}

function getRefinedDefinition(item: MeaningDrillItem | ClozeDrillItem) {
  return getStoredAnswerSetMeta(item)?.refined_definition?.trim() || null;
}

function getContextExplanation(item: MeaningDrillItem | ClozeDrillItem) {
  return getStoredAnswerSetMeta(item)?.context_explanation?.trim() || null;
}

function getSynonymCandidates(item: MeaningDrillItem | ClozeDrillItem) {
  return uniqueNonEmpty(getStoredAnswerSetMeta(item)?.synonym_candidates ?? []);
}

function getAntonymCandidates(item: MeaningDrillItem | ClozeDrillItem) {
  return uniqueNonEmpty(getStoredAnswerSetMeta(item)?.antonym_candidates ?? []);
}

function hasDistinctVariantText(primary: string, candidate: string | null | undefined) {
  if (!candidate) {
    return false;
  }

  return candidate.trim().toLowerCase() !== primary.trim().toLowerCase();
}

function buildStoredAnswerSetOptions(
  answerSet: VocabularyDrillAnswerSet,
  optionPrefix: string
) {
  return shuffle([
    { id: "correct", label: answerSet.drill_correct_answer },
    ...uniqueNonEmpty(answerSet.distractors ?? []).slice(0, 3).map((label, index) => ({
      id: `${optionPrefix}-${index}`,
      label,
    })),
  ]);
}

function buildRankedOptions(params: {
  correctAnswer: string;
  optionPrefix: string;
  storedAnswerSet?: VocabularyDrillAnswerSet | null;
  poolCandidates: Array<string | null | undefined>;
  fallbackCandidates?: Array<string | null | undefined>;
}) {
  const rankedCandidates = rankCandidatesByNormalization(
    params.correctAnswer,
    [
      ...(params.storedAnswerSet?.distractors ?? []),
      ...params.poolCandidates,
      ...(params.fallbackCandidates ?? []),
    ],
    params.storedAnswerSet?.normalization ?? null
  );

  return shuffle([
    { id: "correct", label: params.correctAnswer },
    ...rankedCandidates.slice(0, 3).map((label, index) => ({
      id: `${params.optionPrefix}-${index}`,
      label,
    })),
  ]);
}

function inferAnswerStyle(text: string): VocabularyDrillAnswerNormalization["style"] {
  const normalized = text.trim().toLowerCase();
  const tokenCount = countTokens(normalized);

  if (normalized.startsWith("to ") && tokenCount <= 3) {
    return "infinitive";
  }

  if (tokenCount <= 1) {
    return "single_word";
  }

  if (tokenCount <= 4) {
    return "short_phrase";
  }

  return "clause_like";
}

function inferScriptProfile(text: string) {
  const hasLatin = /[A-Za-z]/.test(text);
  const hasCyrillic = /[А-Яа-яЁё]/.test(text);

  if (hasLatin && !hasCyrillic) {
    return "latin";
  }

  if (hasCyrillic && !hasLatin) {
    return "cyrillic";
  }

  if (hasLatin && hasCyrillic) {
    return "mixed";
  }

  return "other";
}

function inferNormalization(text: string): VocabularyDrillAnswerNormalization {
  return {
    part_of_speech: "unknown",
    difficulty_band: "medium",
    style: inferAnswerStyle(text),
    token_count: countTokens(text),
    character_length: text.trim().length,
  };
}

function rankCandidatesByNormalization(
  correctAnswer: string,
  candidates: Array<string | null | undefined>,
  preferredNormalization?: VocabularyDrillAnswerNormalization | null
) {
  const targetNormalization = preferredNormalization ?? inferNormalization(correctAnswer);
  const targetScript = inferScriptProfile(correctAnswer);

  return uniqueNonEmpty(candidates)
    .filter((candidate) => candidate.toLowerCase() !== correctAnswer.toLowerCase())
    .map((candidate) => {
      const candidateNormalization = inferNormalization(candidate);
      const candidateScript = inferScriptProfile(candidate);
      let score = 0;

      if (candidateNormalization.style === targetNormalization.style) {
        score += 5;
      }

      const tokenDistance = Math.abs(
        candidateNormalization.token_count - targetNormalization.token_count
      );
      if (tokenDistance === 0) {
        score += 4;
      } else if (tokenDistance === 1) {
        score += 2;
      }

      const characterDistance = Math.abs(
        candidateNormalization.character_length - targetNormalization.character_length
      );
      if (
        characterDistance <=
        Math.max(4, Math.round(targetNormalization.character_length * 0.28))
      ) {
        score += 4;
      } else if (
        characterDistance <=
        Math.max(8, Math.round(targetNormalization.character_length * 0.55))
      ) {
        score += 2;
      }

      if (candidateScript === targetScript) {
        score += 3;
      }

      if (
        targetNormalization.style === "infinitive" &&
        candidateNormalization.style === "infinitive"
      ) {
        score += 2;
      }

      return {
        candidate,
        score,
      };
    })
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.candidate);
}

function getDefinitionCandidatePool(
  item: MeaningDrillItem | ClozeDrillItem,
  allItems: Array<MeaningDrillItem | ClozeDrillItem>
) {
  return allItems
    .filter((candidate) => candidate.vocabularyItemId !== item.vocabularyItemId)
    .flatMap((candidate) => [
      getRefinedDefinition(candidate),
      getStoredAnswerSet(candidate, "context_meaning")?.drill_correct_answer,
      getPlainMeaning(candidate),
      ...(candidate.distractors ?? []),
    ]);
}

function buildListenAnswerOptions(params: {
  correctAnswer: string;
  storedAnswerSet?: VocabularyDrillAnswerSet | null;
  poolCandidates: Array<string | null | undefined>;
  fallbackCandidates?: Array<string | null | undefined>;
  optionPrefix: string;
}) {
  const rankedCandidates = rankCandidatesByNormalization(
    params.correctAnswer,
    [
      ...(params.storedAnswerSet?.distractors ?? []),
      ...params.poolCandidates,
      ...(params.fallbackCandidates ?? []),
    ],
    params.storedAnswerSet?.normalization ?? null
  );
  const distractors = rankedCandidates.slice(0, 3);

  return {
    distractors,
    options: shuffle([
      { id: "correct", label: params.correctAnswer },
      ...distractors.map((label, index) => ({
        id: `${params.optionPrefix}-${index}`,
        label,
      })),
    ]),
  };
}

function getMeaningCandidatePool(
  item: MeaningDrillItem | ClozeDrillItem,
  allItems: Array<MeaningDrillItem | ClozeDrillItem>
) {
  return allItems
    .filter((candidate) => candidate.vocabularyItemId !== item.vocabularyItemId)
    .flatMap((candidate) => [
      getStoredAnswerSet(candidate, "context_meaning")?.drill_correct_answer,
      getStoredAnswerSet(candidate, "synonym")?.drill_correct_answer,
      getPlainMeaning(candidate),
    ]);
}

function getSynonymCandidatePool(
  item: MeaningDrillItem | ClozeDrillItem,
  allItems: Array<MeaningDrillItem | ClozeDrillItem>
) {
  return allItems
    .filter((candidate) => candidate.vocabularyItemId !== item.vocabularyItemId)
    .flatMap((candidate) => [
      candidate.itemText,
      getStoredAnswerSet(candidate, "synonym")?.drill_correct_answer,
      ...getSynonymCandidates(candidate),
      ...getAntonymCandidates(candidate),
    ]);
}

function getAntonymDistractorPool(
  item: MeaningDrillItem | ClozeDrillItem,
  allItems: Array<MeaningDrillItem | ClozeDrillItem>
) {
  return [
    ...getSynonymCandidates(item),
    getStoredAnswerSet(item, "synonym")?.drill_correct_answer,
    ...allItems
      .filter((candidate) => candidate.vocabularyItemId !== item.vocabularyItemId)
      .flatMap((candidate) => [
        candidate.itemText,
        ...getAntonymCandidates(candidate),
        ...getSynonymCandidates(candidate),
      ]),
  ];
}

function getTranslationCandidatePool(
  item: MeaningDrillItem | ClozeDrillItem,
  allItems: Array<MeaningDrillItem | ClozeDrillItem>
) {
  return allItems
    .filter((candidate) => candidate.vocabularyItemId !== item.vocabularyItemId)
    .flatMap((candidate) => [
      getStoredAnswerSet(candidate, "translation_english_to_native")?.drill_correct_answer,
      getPreferredNativeTranslation(candidate),
    ]);
}

function getFillBlankCandidatePool(
  item: MeaningDrillItem | ClozeDrillItem,
  allItems: Array<MeaningDrillItem | ClozeDrillItem>
) {
  return [
    ...getLexicalDistractorCandidates(item, allItems),
    ...allItems
      .filter((candidate) => candidate.vocabularyItemId !== item.vocabularyItemId)
      .flatMap((candidate) => [
        candidate.itemText,
        getStoredAnswerSet(candidate, "collocation")?.drill_correct_answer,
        ...(getStoredAnswerSet(candidate, "collocation")?.distractors ?? []),
      ]),
  ];
}

function getListenPairRightLabel(
  item: MeaningDrillItem | ClozeDrillItem,
  variant: "english" | "meaning" | "translation"
) {
  if (variant === "translation") {
    return getPreferredNativeTranslation(item) ?? getPlainMeaning(item);
  }

  if (variant === "english") {
    return item.itemText;
  }

  return getPlainMeaning(item);
}

function dedupeListenPairItems(
  items: Array<MeaningDrillItem | ClozeDrillItem>,
  variant: "english" | "meaning" | "translation"
) {
  const seenWord = new Set<string>();
  const seenRight = new Set<string>();
  const deduped: Array<MeaningDrillItem | ClozeDrillItem> = [];

  for (const item of items) {
    const normalizedWord = normalizePairSideText(item.itemText);
    const normalizedRight = normalizePairSideText(getListenPairRightLabel(item, variant));

    if (!normalizedWord || !normalizedRight) {
      continue;
    }

    if (seenWord.has(normalizedWord) || seenRight.has(normalizedRight)) {
      continue;
    }

    seenWord.add(normalizedWord);
    seenRight.add(normalizedRight);
    deduped.push(item);
  }

  return deduped;
}

function buildTranslationOptions(
  item: MeaningDrillItem | ClozeDrillItem,
  allItems: Array<MeaningDrillItem | ClozeDrillItem>,
  optionPrefix: string
) {
  const correctTranslation = getPreferredNativeTranslation(item) ?? getPlainMeaning(item);
  const translatedDistractors = uniqueNonEmpty(
    allItems
      .filter((candidate) => candidate.vocabularyItemId !== item.vocabularyItemId)
      .map((candidate) => getPreferredNativeTranslation(candidate))
  )
    .filter((candidate) => candidate.toLowerCase() !== correctTranslation.toLowerCase())
    .slice(0, 3);

  return shuffle([
    { id: "correct", label: correctTranslation },
    ...translatedDistractors.map((label, index) => ({
      id: `${optionPrefix}-${index}`,
      label,
    })),
  ]);
}

function buildLexicalOptions(
  item: MeaningDrillItem | ClozeDrillItem,
  allItems: Array<MeaningDrillItem | ClozeDrillItem>,
  optionPrefix: string
) {
  const lexicalDistractors = getLexicalDistractorCandidates(item, allItems).slice(0, 3);

  return shuffle([
    { id: "correct", label: item.itemText },
    ...lexicalDistractors.map((label, index) => ({
      id: `${optionPrefix}-${index}`,
      label,
    })),
  ]);
}

function buildExplanationPrefix(itemType: MeaningDrillItem["itemType"]) {
  return itemType === "phrase" ? "Best paraphrase" : "Best meaning";
}

function chunkItems<T>(items: T[], chunkSize: number, minimumSize = 3) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    const chunk = items.slice(index, index + chunkSize);
    if (chunk.length >= minimumSize) {
      chunks.push(chunk);
    }
  }

  return chunks;
}

function chunkItemsBalanced<T>(items: T[], preferredSize = 6, maxSize = 8, minimumSize = 4) {
  if (items.length <= maxSize) {
    return items.length > 0 ? [items] : [];
  }

  const chunks: T[][] = [];
  let index = 0;

  while (index < items.length) {
    const remaining = items.length - index;

    if (remaining <= maxSize) {
      chunks.push(items.slice(index));
      break;
    }

    let nextSize = preferredSize;
    const tailAfterPreferred = remaining - preferredSize;

    if (tailAfterPreferred > 0 && tailAfterPreferred < minimumSize) {
      nextSize = Math.min(maxSize, remaining - minimumSize);
    }

    chunks.push(items.slice(index, index + nextSize));
    index += nextSize;
  }

  if (chunks.length >= 2) {
    const lastChunk = chunks[chunks.length - 1];
    const previousChunk = chunks[chunks.length - 2];

    if (
      lastChunk.length < minimumSize &&
      previousChunk.length + lastChunk.length <= maxSize
    ) {
      chunks[chunks.length - 2] = [...previousChunk, ...lastChunk];
      chunks.pop();
    }
  }

  return chunks;
}

type PairMatchEntry = {
  item: MeaningDrillItem | ClozeDrillItem;
  left: string;
  right: string;
};

function normalizePairSideText(text: string) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function dedupePairEntries(entries: PairMatchEntry[]) {
  const seenLeft = new Set<string>();
  const seenRight = new Set<string>();
  const deduped: PairMatchEntry[] = [];

  for (const entry of entries) {
    const normalizedLeft = normalizePairSideText(entry.left);
    const normalizedRight = normalizePairSideText(entry.right);

    if (!normalizedLeft || !normalizedRight) {
      continue;
    }

    if (seenLeft.has(normalizedLeft) || seenRight.has(normalizedRight)) {
      continue;
    }

    seenLeft.add(normalizedLeft);
    seenRight.add(normalizedRight);
    deduped.push(entry);
  }

  return deduped;
}

function buildPairMatchExercise(params: {
  id: string;
  pairEntries: PairMatchEntry[];
  prompt: string;
  instructions: string;
  questionText: string;
  explanation: string;
  variant: PairMatchVocabExercise["variant"];
  leftColumnLabel: string;
  rightColumnLabel: string;
  modality: PairMatchVocabExercise["modality"];
  difficultyBand: PairMatchVocabExercise["difficulty_band"];
  tags: string[];
}): PairMatchVocabExercise | null {
  const pairEntries = dedupePairEntries(params.pairEntries);
  const anchorItem = pairEntries[0]?.item;
  if (!anchorItem) {
    return null;
  }

  if (pairEntries.length < 4) {
    return null;
  }

  const pairRecords = pairEntries.map((entry, index) => ({
    id: `pair-${index + 1}`,
    left: entry.left,
    right: entry.right,
    left_id: `left-${index + 1}`,
    right_id: `right-${index + 1}`,
  }));
  const leftOptions = shuffleBySeed(
    pairRecords.map((pair) => ({
      id: pair.left_id,
      label: pair.left,
    })),
    `${params.id}:left`
  );
  const rightOptions = shuffleBySeed(
    pairRecords.map((pair) => ({
      id: pair.right_id,
      label: pair.right,
    })),
    `${params.id}:right`
  );
  const pairWordIds = uniqueNonEmpty(
    pairEntries.map((entry) => entry.item.vocabularyItemId)
  );
  const pairWords = uniqueNonEmpty(pairEntries.map((entry) => entry.item.itemText));

  return {
    id: params.id,
    type: "pair_match" as const,
    prompt: params.prompt,
    instructions: params.instructions,
    target_word: anchorItem.itemText,
    target_word_id: anchorItem.vocabularyItemId,
    targetWord: anchorItem.itemText,
    targetWordId: anchorItem.vocabularyItemId,
    question_text: params.questionText,
    questionText: params.questionText,
    options: [...leftOptions, ...rightOptions],
    pairs: pairRecords,
    correct_answer: pairRecords.map((pair) => `${pair.left} -> ${pair.right}`).join(" | "),
    correctAnswer: pairRecords.map((pair) => `${pair.left} -> ${pair.right}`).join(" | "),
    acceptable_answers: pairRecords.map((pair) => `${pair.left_id}::${pair.right_id}`),
    acceptableAnswers: pairRecords.map((pair) => `${pair.left_id}::${pair.right_id}`),
    distractors: pairRecords.slice(1).map((pair) => pair.right),
    explanation: params.explanation,
    modality: params.modality,
    difficulty_band: params.difficultyBand,
    metadata: {
      source_drill_id: anchorItem.wordProgressId,
      pair_target_word_ids: pairWordIds,
      pair_target_words: pairWords,
      pair_count: pairRecords.length,
    },
    tags: params.tags,
    skill: "pair_match",
    left_column_label: params.leftColumnLabel,
    leftColumnLabel: params.leftColumnLabel,
    right_column_label: params.rightColumnLabel,
    rightColumnLabel: params.rightColumnLabel,
    variant: params.variant,
    reviewMeta: {
      sourceDrillId: anchorItem.wordProgressId,
      ...buildSourceReviewMeta(anchorItem),
    },
  } satisfies PairMatchVocabExercise;
}

export function adaptMeaningDrillToExercise(
  item: MeaningDrillItem
): MeaningMatchVocabExercise {
  return adaptMeaningDrillToExerciseWithPool(item, [item]);
}

function adaptMeaningDrillToExerciseWithPool(
  item: MeaningDrillItem,
  allItems: MeaningDrillItem[],
  params?: {
    definitionText?: string;
    idSuffix?: string;
    prompt?: string;
    instructions?: string;
    questionText?: string;
    variant?: MeaningMatchVocabExercise["variant"];
    difficultyBand?: MeaningMatchVocabExercise["difficulty_band"];
  }
): MeaningMatchVocabExercise {
  const plainMeaning = params?.definitionText ?? getPlainMeaning(item);
  const questionText =
    params?.questionText ??
    item.itemType === "phrase"
      ? `Which option best paraphrases "${item.itemText}"?`
      : `Which option best defines "${item.itemText}"?`;
  const options = buildRankedOptions({
    correctAnswer: plainMeaning,
    optionPrefix: `distractor-${item.vocabularyItemId}${params?.idSuffix ? `-${params.idSuffix}` : ""}`,
    poolCandidates: getDefinitionCandidatePool(item, allItems),
    fallbackCandidates: item.distractors,
  });
  const metadata = {
    source_drill_id: item.wordProgressId,
    source_item_type: item.itemType,
    definition_source:
      params?.variant === "definition_variant_match" ? "refined_definition" : "stored_meaning",
    context_explanation: getContextExplanation(item),
  };

  return {
    id: `${item.wordProgressId}:meaning_match${params?.idSuffix ? `:${params.idSuffix}` : ""}`,
    type: "meaning_match",
    prompt:
      params?.prompt ??
      item.itemType === "phrase"
        ? "Choose the best paraphrase."
        : "Choose the best meaning.",
    instructions:
      params?.instructions ??
      item.itemType === "phrase"
        ? "Match the phrase to the closest paraphrase."
        : "Match the word to the closest meaning.",
    target_word: item.itemText,
    target_word_id: item.vocabularyItemId,
    targetWord: item.itemText,
    targetWordId: item.vocabularyItemId,
    question_text: questionText,
    questionText,
    options,
    correct_answer: "correct",
    correctAnswer: "correct",
    drill_correct_answer: plainMeaning,
    drillCorrectAnswer: plainMeaning,
    acceptable_answers: ["correct"],
    acceptableAnswers: ["correct"],
    distractors: item.distractors,
    explanation:
      params?.variant === "definition_variant_match"
        ? `${buildExplanationPrefix(item.itemType)}: ${plainMeaning}.`
        : `${buildExplanationPrefix(item.itemType)}: ${plainMeaning}`,
    modality: "text",
    difficulty_band: params?.difficultyBand ?? "easy",
    metadata,
    tags: [item.itemType, "review"],
    skill: item.itemType === "phrase" ? "phrase_paraphrase" : "word_meaning",
    sourceLanguageLabel: "English",
    targetLanguageLabel: "Meaning",
    variant:
      params?.variant ??
      (item.itemType === "phrase" ? "paraphrase_match" : "definition_match"),
    reviewMeta: {
      sourceDrillId: item.wordProgressId,
      ...buildSourceReviewMeta(item),
    },
  };
}

export function adaptMeaningDrillsToExercises(
  items: MeaningDrillItem[]
): SupportedVocabExercise[] {
  return items.flatMap((item) => {
    const refinedDefinition = getRefinedDefinition(item);
    const definitionVariant = hasDistinctVariantText(getPlainMeaning(item), refinedDefinition)
      ? adaptMeaningDrillToExerciseWithPool(item, items, {
          definitionText: refinedDefinition ?? undefined,
          idSuffix: "definition_variant",
          prompt: "Choose the best definition.",
          instructions:
            item.itemType === "phrase"
              ? "Choose the strongest alternate paraphrase for the phrase."
              : "Choose the strongest alternate definition for the word.",
          questionText:
            item.itemType === "phrase"
              ? `Which alternate paraphrase best matches "${item.itemText}"?`
              : `Which alternate definition best matches "${item.itemText}"?`,
          variant: item.itemType === "phrase" ? "paraphrase_match" : "definition_variant_match",
          difficultyBand: "medium",
        })
      : null;

    return [
      adaptMeaningDrillToExerciseWithPool(item, items),
      ...(definitionVariant ? [definitionVariant] : []),
      ...adaptTranslationDrillToExercises(item, items),
    ];
  });
}

export function adaptTranslationDrillToExercises(
  item: MeaningDrillItem,
  allItems: MeaningDrillItem[]
): TranslationMatchVocabExercise[] {
  const translatedMeaning = getPreferredNativeTranslation(item);
  if (!translatedMeaning) {
    return [];
  }

  const englishToNativeAnswerSet = getStoredAnswerSet(
    item,
    "translation_english_to_native"
  );
  const nativeToEnglishAnswerSet = getStoredAnswerSet(
    item,
    "translation_native_to_english"
  );
  const englishToNativeCorrectAnswer =
    englishToNativeAnswerSet?.drill_correct_answer ?? translatedMeaning;
  const nativeToEnglishCorrectAnswer =
    nativeToEnglishAnswerSet?.drill_correct_answer ?? item.itemText;
  const englishToNativeOptions = englishToNativeAnswerSet
    ? buildStoredAnswerSetOptions(
        englishToNativeAnswerSet,
        `translation-native-${item.vocabularyItemId}`
      )
    : buildTranslationOptions(item, allItems, `translation-native-${item.vocabularyItemId}`);
  const nativeToEnglishOptions = nativeToEnglishAnswerSet
    ? buildStoredAnswerSetOptions(
        nativeToEnglishAnswerSet,
        `translation-english-${item.wordProgressId}`
      )
    : buildLexicalOptions(item, allItems, `translation-english-${item.wordProgressId}`);

  return [
    {
      id: `${item.wordProgressId}:translation_match:english_to_native`,
      type: "translation_match",
      prompt: "Translate the word.",
      instructions: "Choose the translation in the student's native language.",
      target_word: item.itemText,
      target_word_id: item.vocabularyItemId,
      targetWord: item.itemText,
      targetWordId: item.vocabularyItemId,
      question_text: `Which translation best matches "${item.itemText}"?`,
      questionText: `Which translation best matches "${item.itemText}"?`,
      options: englishToNativeOptions,
      correct_answer: "correct",
      correctAnswer: "correct",
      drill_correct_answer: englishToNativeCorrectAnswer,
      drillCorrectAnswer: englishToNativeCorrectAnswer,
      acceptable_answers: ["correct"],
      acceptableAnswers: ["correct"],
      distractors: englishToNativeAnswerSet?.distractors ?? item.distractors,
      explanation: `"${item.itemText}" translates here as ${englishToNativeCorrectAnswer}.`,
      modality: "text",
      difficulty_band: "easy",
      metadata: {
        source_drill_id: item.wordProgressId,
        source_item_type: item.itemType,
        translation_language: item.translationLanguage ?? null,
      },
      tags: [item.itemType, "translation", "english_to_native"],
      skill: "translation_match",
      answerSet: englishToNativeAnswerSet ?? undefined,
      sourceLanguageLabel: "English",
      targetLanguageLabel: item.translationLanguage?.toUpperCase() ?? "Native",
      translationLanguageLabel: item.translationLanguage ?? null,
      direction: "english_to_native",
      promptTerm: item.itemText,
      reviewMeta: {
        sourceDrillId: item.wordProgressId,
        ...buildSourceReviewMeta(item),
      },
    },
    {
      id: `${item.wordProgressId}:translation_match:native_to_english`,
      type: "translation_match",
      prompt: "Translate into English.",
      instructions: "Choose the English word that matches the translation shown.",
      target_word: item.itemText,
      target_word_id: item.vocabularyItemId,
      targetWord: item.itemText,
      targetWordId: item.vocabularyItemId,
      question_text: `Which English word matches "${translatedMeaning}"?`,
      questionText: `Which English word matches "${translatedMeaning}"?`,
      options: nativeToEnglishOptions,
      correct_answer: "correct",
      correctAnswer: "correct",
      drill_correct_answer: nativeToEnglishCorrectAnswer,
      drillCorrectAnswer: nativeToEnglishCorrectAnswer,
      acceptable_answers: ["correct"],
      acceptableAnswers: ["correct"],
      distractors: nativeToEnglishAnswerSet?.distractors ?? item.distractors,
      explanation: `${translatedMeaning} maps back to the English word "${nativeToEnglishCorrectAnswer}".`,
      modality: "text",
      difficulty_band: "easy",
      metadata: {
        source_drill_id: item.wordProgressId,
        source_item_type: item.itemType,
        translation_language: item.translationLanguage ?? null,
      },
      tags: [item.itemType, "translation", "native_to_english"],
      skill: "translation_match",
      answerSet: nativeToEnglishAnswerSet ?? undefined,
      sourceLanguageLabel: item.translationLanguage?.toUpperCase() ?? "Native",
      targetLanguageLabel: "English",
      translationLanguageLabel: item.translationLanguage ?? null,
      direction: "native_to_english",
      promptTerm: translatedMeaning,
      reviewMeta: {
        sourceDrillId: item.wordProgressId,
        ...buildSourceReviewMeta(item),
      },
    },
  ];
}

export function adaptPairMatchDrillsToExercises(
  items: Array<MeaningDrillItem | ClozeDrillItem>
): SupportedVocabExercise[] {
  const exercises: SupportedVocabExercise[] = [];
  const definitionEntries = dedupePairEntries(
    items.map((item) => ({
      item,
      left: item.itemText,
      right: getPlainMeaning(item),
    }))
  );
  const definitionGroups = chunkItemsBalanced(definitionEntries, 6, 8, 4);

  exercises.push(
    ...definitionGroups
      .map((group, index) =>
        buildPairMatchExercise({
          id: `${group[0]?.item.wordProgressId ?? index}:pair_match:word_definition:${index + 1}`,
          pairEntries: group,
          prompt: "Match the pairs.",
          instructions: "Tap a word, then tap its matching meaning.",
          questionText: "Match each word to its meaning.",
          explanation: "Each word should connect to the meaning that fits it best.",
          variant: "word_definition",
          leftColumnLabel: "Words",
          rightColumnLabel: "Meanings",
          modality: "text",
          difficultyBand: "easy",
          tags: ["pair_match", "word_definition", "rapid_review"],
        })
      )
      .filter((exercise): exercise is PairMatchVocabExercise => Boolean(exercise))
  );

  const translationEntries = dedupePairEntries(
    items
      .filter((item) => hasUsableNativeTranslation(item))
      .map((item) => ({
        item,
        left: item.itemText,
        right: getPreferredNativeTranslation(item) ?? getPlainMeaning(item),
      }))
  );
  const translationGroups = chunkItemsBalanced(translationEntries, 6, 8, 4);

  exercises.push(
    ...translationGroups
      .map((group, index) =>
        buildPairMatchExercise({
          id: `${group[0]?.item.wordProgressId ?? index}:pair_match:english_native:${index + 1}`,
          pairEntries: group,
          prompt: "Match the translations.",
          instructions: "Tap the English word, then tap its translation.",
          questionText: "Match each English word to its translation.",
          explanation: "Use the closest translation for each word.",
          variant: "english_native",
          leftColumnLabel: "English",
          rightColumnLabel:
            translationGroups[index]?.[0]?.item.translationLanguage?.toUpperCase() ?? "Native",
          modality: "text",
          difficultyBand: "easy",
          tags: ["pair_match", "translation", "english_native"],
        })
      )
      .filter((exercise): exercise is PairMatchVocabExercise => Boolean(exercise))
  );

  return exercises;
}

export function adaptClozeDrillToExercise(item: ClozeDrillItem): FillBlankVocabExercise {
  return adaptClozeDrillToExerciseWithPool(item, [item]);
}

export function adaptClozeDrillToExerciseWithPool(
  item: ClozeDrillItem,
  allItems: ClozeDrillItem[]
): FillBlankVocabExercise {
  const questionText = "Which option best completes the sentence?";
  const sentenceText = makeBlank(item.contextSentence, item.itemText);
  const answerSet = getStoredAnswerSet(item, "collocation");
  const drillCorrectAnswer = answerSet?.drill_correct_answer ?? item.itemText;
  const options = answerSet
    ? buildRankedOptions({
        correctAnswer: drillCorrectAnswer,
        optionPrefix: `fill-blank-${item.wordProgressId}`,
        storedAnswerSet: answerSet,
        poolCandidates: getFillBlankCandidatePool(item, allItems),
        fallbackCandidates: item.distractors,
      })
    : buildLexicalOptions(item, allItems, `fill-blank-${item.wordProgressId}`);
  const plainMeaning = getPlainMeaning(item);
  const metadata = {
    source_drill_id: item.wordProgressId,
    source_item_type: item.itemType,
    source_context_sentence: item.contextSentence,
    distractor_source:
      answerSet && allItems.length > 1 ? "stored_plus_captured_pool" : "captured_pool",
  };

  return {
    id: `${item.wordProgressId}:fill_blank`,
    type: "fill_blank",
    prompt: "Fill in the blank.",
    instructions: "Choose the option that best completes the sentence.",
    target_word: item.itemText,
    target_word_id: item.vocabularyItemId,
    targetWord: item.itemText,
    targetWordId: item.vocabularyItemId,
    question_text: questionText,
    questionText,
    sentence_text: sentenceText,
    sentenceText,
    options,
    correct_answer: "correct",
    correctAnswer: "correct",
    drill_correct_answer: drillCorrectAnswer,
    drillCorrectAnswer: drillCorrectAnswer,
    acceptable_answers: ["correct"],
    acceptableAnswers: ["correct"],
    distractors: answerSet?.distractors ?? item.distractors,
    explanation: `"${drillCorrectAnswer}" fits this context because "${item.itemText}" means ${plainMeaning}.`,
    modality: "context",
    difficulty_band: "medium",
    variant: "single_blank",
    metadata,
    skill: "fill_blank",
    tags: [item.itemType, "context", "cloze"],
    reviewMeta: {
      sourceDrillId: item.wordProgressId,
      ...buildSourceReviewMeta(item),
    },
  };
}

export function adaptClozeDrillsToExercises(
  items: ClozeDrillItem[]
): SupportedVocabExercise[] {
  return items.flatMap((item) => {
    const primary = adaptClozeDrillToExerciseWithPool(item, items);
    const contextHint = item.exampleText?.trim();

    if (!contextHint || contextHint === item.contextSentence) {
      return [primary];
    }

    return [
      primary,
      {
        ...primary,
        id: `${item.wordProgressId}:fill_blank:context_clue`,
        instructions: "Use the sentence and the added context clue to choose the best fit.",
        question_text: "Which option best fits once you consider the broader context?",
        questionText: "Which option best fits once you consider the broader context?",
        explanation: `"${item.itemText}" matches both the sentence and the extra context clue because it means ${getPlainMeaning(item)}.`,
        difficulty_band: "hard",
        variant: "context_clue",
        contextHint,
        tags: [...(primary.tags ?? []), "context_clue"],
      },
    ];
  });
}

export function adaptListenMatchDrillToExercise(
  item: MeaningDrillItem | ClozeDrillItem,
  allItems: Array<MeaningDrillItem | ClozeDrillItem>
): SupportedVocabExercise {
  const sourceSentence = getSourceSentence(item);
  const plainMeaning = getPlainMeaning(item);
  const translatedMeaning = getTranslatedMeaning(item);
  const translationAnswerSet = getStoredAnswerSet(item, "translation_english_to_native");
  const meaningAnswerSet = getStoredAnswerSet(item, "context_meaning");
  const translationPayload = translatedMeaning
    ? buildListenAnswerOptions({
        correctAnswer: translationAnswerSet?.drill_correct_answer ?? translatedMeaning,
        storedAnswerSet: translationAnswerSet,
        poolCandidates: getTranslationCandidatePool(item, allItems),
        fallbackCandidates: translatedMeaning ? [translatedMeaning] : [],
        optionPrefix: `listen-translation-${item.wordProgressId}`,
      })
    : null;
  const meaningPayload = buildListenAnswerOptions({
    correctAnswer: meaningAnswerSet?.drill_correct_answer ?? plainMeaning,
    storedAnswerSet: meaningAnswerSet,
    poolCandidates: getMeaningCandidatePool(item, allItems),
    fallbackCandidates: item.distractors,
    optionPrefix: `listen-meaning-${item.wordProgressId}`,
  });
  const translationReady = Boolean(
    translationPayload && translationPayload.distractors.length >= 2
  );
  const meaningReady = meaningPayload.distractors.length >= 2;
  const preferTranslation =
    translationReady &&
    (!meaningReady ||
      (Boolean(translationAnswerSet) && !meaningAnswerSet) ||
      item.wordProgressId.length % 2 === 0);
  const variant = preferTranslation ? "translation" : "meaning";
  const prompt =
    variant === "translation"
      ? "Listen and choose the translation."
      : "Listen and choose the meaning.";
  const instructions =
    variant === "translation"
      ? "Play the audio, then choose the best translation for the word you hear."
      : "Play the audio, then choose the best meaning for the word you hear.";
  const questionText =
    variant === "translation"
      ? `Which ${item.translationLanguage?.toUpperCase() ?? "translation"} best matches the audio?`
      : "Which meaning best matches the audio?";
  const selectedPayload =
    variant === "translation" && translationPayload ? translationPayload : meaningPayload;
  const drillCorrectAnswer =
    variant === "translation"
      ? translationAnswerSet?.drill_correct_answer ?? translatedMeaning ?? plainMeaning
      : meaningAnswerSet?.drill_correct_answer ?? plainMeaning;
  const explanation =
    variant === "translation"
      ? `The audio matches the translation ${drillCorrectAnswer}.`
      : `The audio matches the meaning ${drillCorrectAnswer}.`;
  const distractors = selectedPayload.distractors;
  const difficultyBand =
    variant === "translation"
      ? translationAnswerSet?.normalization.difficulty_band ?? "medium"
      : meaningAnswerSet?.normalization.difficulty_band ?? "medium";

  return {
    id: `${item.wordProgressId}:listen_match`,
    type: "listen_match",
    prompt,
    instructions,
    target_word: item.itemText,
    target_word_id: item.vocabularyItemId,
    targetWord: item.itemText,
    targetWordId: item.vocabularyItemId,
    question_text: questionText,
    questionText,
    sentence_text: sourceSentence || null,
    sentenceText: sourceSentence || null,
    options: selectedPayload.options,
    correct_answer: "correct",
    correctAnswer: "correct",
    drill_correct_answer: drillCorrectAnswer,
    drillCorrectAnswer: drillCorrectAnswer,
    acceptable_answers: ["correct"],
    acceptableAnswers: ["correct"],
    distractors,
    explanation,
    modality: "audio",
    difficulty_band: difficultyBand,
    variant,
    promptStyle: variant === "translation" ? "best_translation" : "best_meaning",
    answerSet:
      variant === "translation"
        ? translationAnswerSet ?? undefined
        : meaningAnswerSet ?? undefined,
    translationLanguageLabel: item.translationLanguage ?? null,
    metadata: {
      source_drill_id: item.wordProgressId,
      source_item_type: item.itemType,
      source_sentence: sourceSentence || null,
      audio_url: item.audioUrl ?? null,
      audio_status: item.audioStatus ?? "missing",
      listen_variant: variant,
      listens_for_meaning: true,
      answer_source: variant === "translation" && translationAnswerSet
        ? "normalized_translation_set"
        : variant === "meaning" && meaningAnswerSet
          ? "normalized_meaning_set"
          : "ranked_candidate_pool",
    },
    tags:
      variant === "translation"
        ? [item.itemType, "audio", "translation", "comprehension"]
        : [item.itemType, "audio", "meaning", "comprehension"],
    skill: "listen_match",
    audio_url: item.audioUrl ?? null,
    audioUrl: item.audioUrl ?? null,
    audio_status: item.audioStatus ?? (item.audioUrl ? "ready" : "missing"),
    audioStatus: item.audioStatus ?? (item.audioUrl ? "ready" : "missing"),
    reviewMeta: {
      sourceDrillId: item.wordProgressId,
      ...buildSourceReviewMeta(item),
    },
  };
}

function buildListenPairMatchExercise(params: {
  id: string;
  items: Array<MeaningDrillItem | ClozeDrillItem>;
  variant: "english" | "meaning" | "translation";
  rightColumnLabel: string;
}): SupportedVocabExercise | null {
  const uniqueItems = dedupeListenPairItems(params.items, params.variant);
  const anchorItem = uniqueItems[0];
  if (!anchorItem) {
    return null;
  }

  if (uniqueItems.length < 4) {
    return null;
  }

  const pairRecords = uniqueItems.map((item, index) => ({
    id: `pair-${index + 1}`,
    left: item.itemText,
    right: getListenPairRightLabel(item, params.variant),
    left_id: `left-${index + 1}`,
    right_id: `right-${index + 1}`,
    left_audio_url: item.audioUrl ?? null,
    left_kind: "audio" as const,
  }));

  const leftOptions = shuffleBySeed(
    pairRecords.map((pair) => ({
      id: pair.left_id,
      label: pair.left,
    })),
    `${params.id}:left`
  );
  const rightOptions = shuffleBySeed(
    pairRecords.map((pair) => ({
      id: pair.right_id,
      label: pair.right,
    })),
    `${params.id}:right`
  );

  return {
    id: params.id,
    type: "listen_match",
    prompt:
      params.variant === "translation"
        ? "Listen and match the translations."
        : params.variant === "english"
          ? "Listen and match the English words."
        : "Listen and match the meanings.",
    instructions:
      params.variant === "translation"
        ? "Play each audio clip on the left, then match it to the best translation on the right."
        : params.variant === "english"
          ? "Play each audio clip on the left, then match it to the English word you hear."
        : "Play each audio clip on the left, then match it to the best meaning on the right.",
    target_word: anchorItem.itemText,
    target_word_id: anchorItem.vocabularyItemId,
    targetWord: anchorItem.itemText,
    targetWordId: anchorItem.vocabularyItemId,
    question_text:
      params.variant === "translation"
        ? `Match each audio clip to its ${params.rightColumnLabel.toLowerCase()}.`
        : params.variant === "english"
          ? "Match each audio clip to its English word."
        : "Match each audio clip to its meaning.",
    questionText:
      params.variant === "translation"
        ? `Match each audio clip to its ${params.rightColumnLabel.toLowerCase()}.`
        : params.variant === "english"
          ? "Match each audio clip to its English word."
        : "Match each audio clip to its meaning.",
    options: [...leftOptions, ...rightOptions],
    pairs: pairRecords,
    correct_answer: pairRecords.map((pair) => `${pair.left_id}::${pair.right_id}`).join(" | "),
    correctAnswer: pairRecords.map((pair) => `${pair.left_id}::${pair.right_id}`).join(" | "),
    acceptable_answers: pairRecords.map((pair) => `${pair.left_id}::${pair.right_id}`),
    acceptableAnswers: pairRecords.map((pair) => `${pair.left_id}::${pair.right_id}`),
    distractors: pairRecords.slice(1).map((pair) => pair.right),
    explanation:
      params.variant === "translation"
        ? "Each audio clip should connect to the translation that matches the spoken word."
        : params.variant === "english"
          ? "Each audio clip should connect to the English word being spoken."
        : "Each audio clip should connect to the meaning that matches the spoken word.",
    modality: "audio",
    difficulty_band: "medium",
    variant: params.variant,
    promptStyle:
      params.variant === "translation"
        ? "best_translation"
        : params.variant === "english"
          ? "best_word"
          : "best_meaning",
    translationLanguageLabel:
      params.variant === "translation" ? anchorItem.translationLanguage ?? null : null,
    left_column_label: "Audio",
    leftColumnLabel: "Audio",
    right_column_label: params.rightColumnLabel,
    rightColumnLabel: params.rightColumnLabel,
    metadata: {
      source_drill_id: anchorItem.wordProgressId,
      pair_target_word_ids: uniqueNonEmpty(uniqueItems.map((item) => item.vocabularyItemId)),
      pair_target_words: uniqueNonEmpty(uniqueItems.map((item) => item.itemText)),
      pair_count: pairRecords.length,
      listen_variant:
        params.variant === "translation"
          ? "translation_pairs"
          : params.variant === "english"
            ? "english_pairs"
            : "meaning_pairs",
    },
    tags:
      params.variant === "translation"
        ? ["audio", "translation", "pair_match", "comprehension"]
        : params.variant === "english"
          ? ["audio", "english", "pair_match", "dictation"]
        : ["audio", "meaning", "pair_match", "comprehension"],
    skill: "listen_match",
    audio_url: anchorItem.audioUrl ?? null,
    audioUrl: anchorItem.audioUrl ?? null,
    audio_status: "ready",
    audioStatus: "ready",
    reviewMeta: {
      sourceDrillId: anchorItem.wordProgressId,
      ...buildSourceReviewMeta(anchorItem),
    },
  };
}

export function adaptListenMatchDrillsToExercises(
  items: Array<MeaningDrillItem | ClozeDrillItem>
): SupportedVocabExercise[] {
  const audioReadyItems = items.filter(
    (item) => Boolean(item.audioUrl) && item.audioStatus !== "failed" && item.audioStatus !== "missing"
  );
  const englishGroups = chunkItemsBalanced(
    dedupeListenPairItems(audioReadyItems, "english"),
    8,
    10,
    4
  );
  const meaningGroups = chunkItemsBalanced(
    dedupeListenPairItems(audioReadyItems, "meaning"),
    8,
    10,
    4
  );
  const translationGroups = chunkItemsBalanced(
    dedupeListenPairItems(
      audioReadyItems.filter((item) => Boolean(getTranslatedMeaning(item))),
      "translation"
    ),
    8,
    10,
    4
  );

  const groupedExercises = [
    ...translationGroups
      .map((group, index) =>
        buildListenPairMatchExercise({
          id: `${group[0]?.wordProgressId ?? index}:listen_match:translation_pairs:${index + 1}`,
          items: group,
          variant: "translation",
          rightColumnLabel: group[0]?.translationLanguage?.toUpperCase() ?? "Translations",
        })
      )
      .filter((exercise): exercise is SupportedVocabExercise => Boolean(exercise)),
    ...englishGroups
      .map((group, index) =>
        buildListenPairMatchExercise({
          id: `${group[0]?.wordProgressId ?? index}:listen_match:english_pairs:${index + 1}`,
          items: group,
          variant: "english",
          rightColumnLabel: "English",
        })
      )
      .filter((exercise): exercise is SupportedVocabExercise => Boolean(exercise)),
    ...meaningGroups
      .map((group, index) =>
        buildListenPairMatchExercise({
          id: `${group[0]?.wordProgressId ?? index}:listen_match:meaning_pairs:${index + 1}`,
          items: group,
          variant: "meaning",
          rightColumnLabel: "Meanings",
        })
      )
      .filter((exercise): exercise is SupportedVocabExercise => Boolean(exercise)),
  ];

  if (groupedExercises.length > 0) {
    return groupedExercises;
  }

  return items.map((item) => adaptListenMatchDrillToExercise(item, items));
}

export function adaptSpellingFromAudioDrillToExercise(
  item: MeaningDrillItem | ClozeDrillItem
): SupportedVocabExercise {
  const sourceSentence = getSourceSentence(item);
  const plainMeaning = getPlainMeaning(item);
  const translatedMeaning = getPreferredNativeTranslation(item);

  return {
    id: `${item.wordProgressId}:spelling_from_audio`,
    type: "spelling_from_audio",
    prompt: "Listen and spell the word.",
    instructions: "Play the audio, then type the word you hear exactly.",
    target_word: item.itemText,
    target_word_id: item.vocabularyItemId,
    targetWord: item.itemText,
    targetWordId: item.vocabularyItemId,
    question_text: "Type the word you hear.",
    questionText: "Type the word you hear.",
    sentence_text: sourceSentence || null,
    sentenceText: sourceSentence || null,
    options: [],
    correct_answer: item.itemText,
    correctAnswer: item.itemText,
    acceptable_answers: [item.itemText],
    acceptableAnswers: [item.itemText],
    distractors: item.distractors,
    explanation: `The correct spelling is "${item.itemText}", which means ${plainMeaning}.`,
    modality: "audio",
    difficulty_band: "medium",
    metadata: {
      source_drill_id: item.wordProgressId,
      source_item_type: item.itemType,
      source_sentence: sourceSentence || null,
      audio_url: item.audioUrl ?? null,
      audio_status: item.audioStatus ?? "missing",
      normalization: "trim_lowercase",
    },
    tags: [item.itemType, "audio", "spelling"],
    skill: "spelling_from_audio",
    placeholder: "Type what you heard",
    inputLabel: "Spell the word",
    translation_text: translatedMeaning,
    translationText: translatedMeaning,
    translationLanguageLabel: item.translationLanguage ?? null,
    audio_url: item.audioUrl ?? null,
    audioUrl: item.audioUrl ?? null,
    audio_status: item.audioStatus ?? (item.audioUrl ? "ready" : "missing"),
    audioStatus: item.audioStatus ?? (item.audioUrl ? "ready" : "missing"),
    reviewMeta: {
      sourceDrillId: item.wordProgressId,
      ...buildSourceReviewMeta(item),
    },
  };
}

export function adaptSpellingFromAudioDrillsToExercises(
  items: Array<MeaningDrillItem | ClozeDrillItem>
): SupportedVocabExercise[] {
  return items.map(adaptSpellingFromAudioDrillToExercise);
}

export function adaptSentenceBuilderDrillToExercise(
  item: MeaningDrillItem | ClozeDrillItem
): SentenceBuilderVocabExercise | null {
  const sourceSentence = normalizeSentence(getSourceSentence(item));
  if (!sourceSentence) {
    return null;
  }

  const tiles = sourceSentence.split(" ").filter(Boolean);
  if (tiles.length < 4 || tiles.length > 12) {
    return null;
  }

  const orderedTiles = tiles.map((label, index) => ({
    id: `tile-${index + 1}`,
    label,
  }));
  const shuffledTiles = shuffleBySeed(orderedTiles, `${item.wordProgressId}:sentence_builder`);

  return {
    id: `${item.wordProgressId}:sentence_builder`,
    type: "sentence_builder",
    prompt: "Build the sentence.",
    instructions: "Tap the tiles to rebuild the sentence in the correct order.",
    target_word: item.itemText,
    target_word_id: item.vocabularyItemId,
    targetWord: item.itemText,
    targetWordId: item.vocabularyItemId,
    question_text: `Build the sentence that uses "${item.itemText}" naturally.`,
    questionText: `Build the sentence that uses "${item.itemText}" naturally.`,
    sentence_text: sourceSentence,
    sentenceText: sourceSentence,
    options: shuffledTiles,
    correct_answer: sourceSentence,
    correctAnswer: sourceSentence,
    acceptable_answers: [sourceSentence],
    acceptableAnswers: [sourceSentence],
    correct_sequence: orderedTiles.map((tile) => tile.id),
    correctSequence: orderedTiles.map((tile) => tile.id),
    distractors: item.distractors,
    explanation: `The natural sentence order is: ${sourceSentence}`,
    modality: "context",
    difficulty_band: "hard",
    tileStyle: item.itemType === "phrase" ? "phrase_bank" : "word_bank",
    clue: item.plainMeaning
      ? `Meaning clue: ${getPlainMeaning(item)}`
      : null,
    metadata: {
      source_drill_id: item.wordProgressId,
      source_item_type: item.itemType,
      source_sentence: sourceSentence,
      tile_count: orderedTiles.length,
    },
    tags: [item.itemType, "sentence_builder", "syntax", "collocation"],
    skill: "sentence_builder",
    reviewMeta: {
      sourceDrillId: item.wordProgressId,
      ...buildSourceReviewMeta(item),
    },
  };
}

export function adaptSentenceBuilderDrillsToExercises(
  items: Array<MeaningDrillItem | ClozeDrillItem>
): SupportedVocabExercise[] {
  return items
    .map(adaptSentenceBuilderDrillToExercise)
    .filter((exercise): exercise is SentenceBuilderVocabExercise => Boolean(exercise));
}

function splitSentenceIntoErrorSegments(sentence: string, errorPhrase: string) {
  const pattern = new RegExp(escapeRegExp(errorPhrase), "i");
  const match = sentence.match(pattern);
  if (!match || match.index === undefined) {
    return [] as Array<{ id: string; text: string }>;
  }

  const start = match.index;
  const end = start + match[0].length;
  const before = sentence.slice(0, start).trim();
  const error = sentence.slice(start, end).trim();
  const after = sentence.slice(end).trim();

  return [
    before ? { id: "segment-1", text: before } : null,
    { id: "segment-2", text: error },
    after ? { id: "segment-3", text: after } : null,
  ].filter((segment): segment is { id: string; text: string } => Boolean(segment));
}

export function adaptErrorDetectionDrillToExercise(
  item: MeaningDrillItem | ClozeDrillItem,
  allItems: Array<MeaningDrillItem | ClozeDrillItem>
): ErrorDetectionVocabExercise | null {
  const sourceSentence = normalizeSentence(getSourceSentence(item));
  if (!sourceSentence) {
    return null;
  }

  const replacement = getLexicalDistractorCandidates(item, allItems)[0];
  if (!replacement) {
    return null;
  }

  const sentenceWithError = sourceSentence.replace(
    new RegExp(escapeRegExp(item.itemText), "i"),
    replacement
  );
  if (sentenceWithError === sourceSentence) {
    return null;
  }

  const sentenceSegments = splitSentenceIntoErrorSegments(sentenceWithError, replacement);
  if (sentenceSegments.length < 2) {
    return null;
  }

  const errorSegment = sentenceSegments.find((segment) =>
    segment.text.toLowerCase().includes(replacement.toLowerCase())
  );
  if (!errorSegment) {
    return null;
  }

  return {
    id: `${item.wordProgressId}:error_detection`,
    type: "error_detection",
    prompt: "Find the language error.",
    instructions: "Choose the word or phrase that should be changed.",
    target_word: item.itemText,
    target_word_id: item.vocabularyItemId,
    targetWord: item.itemText,
    targetWordId: item.vocabularyItemId,
    question_text: "Which part of the sentence should be revised?",
    questionText: "Which part of the sentence should be revised?",
    sentence_text: sentenceWithError,
    sentenceText: sentenceWithError,
    sentence_segments: sentenceSegments,
    sentenceSegments: sentenceSegments,
    options: sentenceSegments.map((segment) => ({
      id: segment.id,
      label: segment.text,
    })),
    correct_answer: errorSegment.id,
    correctAnswer: errorSegment.id,
    acceptable_answers: [errorSegment.id],
    acceptableAnswers: [errorSegment.id],
    distractors: item.distractors,
    explanation: `The sentence becomes strongest when "${replacement}" is replaced with "${item.itemText}".`,
    replacement_text: item.itemText,
    replacementText: item.itemText,
    allow_no_error: false,
    allowNoError: false,
    variant: "find_error",
    modality: "context",
    difficulty_band: "hard",
    metadata: {
      source_drill_id: item.wordProgressId,
      source_item_type: item.itemType,
      source_sentence: sourceSentence,
      error_replacement: replacement,
    },
    tags: [item.itemType, "error_detection", "sat_style", "precision"],
    skill: "error_detection",
    reviewMeta: {
      sourceDrillId: item.wordProgressId,
      ...buildSourceReviewMeta(item),
    },
  };
}

export function adaptErrorDetectionDrillsToExercises(
  items: Array<MeaningDrillItem | ClozeDrillItem>
): SupportedVocabExercise[] {
  return items
    .map((item) => adaptErrorDetectionDrillToExercise(item, items))
    .filter((exercise): exercise is ErrorDetectionVocabExercise => Boolean(exercise));
}

export function adaptContextMeaningDrillToExercise(
  item: MeaningDrillItem | ClozeDrillItem
): SupportedVocabExercise | null {
  const preferredPracticeSentence = getPreferredPracticeSentence(item);
  const contextText = preferredPracticeSentence.sentence || getSourceSentence(item);
  if (!contextText) {
    return null;
  }

  const answerSet = getStoredAnswerSet(item, "context_meaning");
  const questionText =
    item.itemType === "phrase"
      ? `What does "${item.itemText}" mean in this sentence?`
      : `What does "${item.itemText}" mean in this sentence?`;
  const plainMeaning = answerSet?.drill_correct_answer ?? getPlainMeaning(item);

  return {
    id: `${item.wordProgressId}:context_meaning`,
    type: "context_meaning",
    prompt: "Use the context to infer the meaning.",
    instructions:
      item.itemType === "phrase"
        ? "Read the full sentence and choose the closest meaning of the phrase in context."
        : "Read the full sentence and choose the closest meaning of the highlighted word in context.",
    target_word: item.itemText,
    target_word_id: item.vocabularyItemId,
    targetWord: item.itemText,
    targetWordId: item.vocabularyItemId,
    question_text: questionText,
    questionText,
    sentence_text: contextText,
    sentenceText: contextText,
    contextText,
    focusText: item.itemText,
    options: answerSet
      ? buildStoredAnswerSetOptions(answerSet, `context-${item.wordProgressId}`)
      : buildMeaningOptions(item, `context-${item.wordProgressId}`),
    correct_answer: "correct",
    correctAnswer: "correct",
    drill_correct_answer: plainMeaning,
    drillCorrectAnswer: plainMeaning,
    acceptable_answers: ["correct"],
    acceptableAnswers: ["correct"],
    distractors: answerSet?.distractors ?? item.distractors,
    explanation: `Context clue points to: ${plainMeaning}`,
    modality: "context",
    difficulty_band: "hard",
    metadata: {
      source_drill_id: item.wordProgressId,
      source_item_type: item.itemType,
      source_context_sentence: contextText,
      prompt_sentence_source:
        preferredPracticeSentence.source !== "none"
          ? preferredPracticeSentence.source
          : "source_context",
    },
    tags: [item.itemType, "context", "inference"],
    skill: "context_meaning",
    answerSet: answerSet ?? undefined,
    reviewMeta: {
      sourceDrillId: item.wordProgressId,
      ...buildSourceReviewMeta(item),
    },
  };
}

export function adaptContextMeaningDrillsToExercises(
  items: Array<MeaningDrillItem | ClozeDrillItem>
): SupportedVocabExercise[] {
  return items
    .map(adaptContextMeaningDrillToExercise)
    .filter((exercise): exercise is SupportedVocabExercise => Boolean(exercise));
}

export function adaptSynonymDrillToExercise(
  item: MeaningDrillItem | ClozeDrillItem,
  allItems: Array<MeaningDrillItem | ClozeDrillItem>,
  variant: SynonymVocabExercise["variant"] = "synonym"
): SynonymVocabExercise {
  const answerSet = getStoredAnswerSet(item, "synonym");
  const synonymCandidates = getSynonymCandidates(item);
  const antonymCandidates = getAntonymCandidates(item);
  const correctAnswer =
    variant === "antonym"
      ? antonymCandidates[0] ?? null
      : synonymCandidates[0] ?? answerSet?.drill_correct_answer ?? null;
  const optionPool =
    variant === "antonym"
      ? getAntonymDistractorPool(item, allItems)
      : [
          ...getSynonymCandidatePool(item, allItems),
          ...synonymCandidates,
          answerSet?.drill_correct_answer,
        ];
  const resolvedCorrectAnswer =
    correctAnswer ?? answerSet?.drill_correct_answer ?? getPlainMeaning(item);
  const preferredPracticeSentence = getPreferredPracticeSentence(item);
  const sentenceText = preferredPracticeSentence.sentence;
  const questionText = sentenceText
    ? variant === "antonym"
      ? item.itemType === "phrase"
        ? `Which option is the best opposite of "${item.itemText}" in the sentence?`
        : `Which option is the best antonym for "${item.itemText}" in the sentence?`
      : item.itemType === "phrase"
        ? `Which option best replaces "${item.itemText}" in the sentence?`
        : `Which option could best replace "${item.itemText}" in the sentence?`
    : variant === "antonym"
      ? item.itemType === "phrase"
        ? `Which option is the best opposite of "${item.itemText}"?`
        : `Which option is the best antonym for "${item.itemText}"?`
      : item.itemType === "phrase"
        ? `Which option is the closest substitute for "${item.itemText}"?`
        : `Which option is the closest synonym or substitute for "${item.itemText}"?`;
  const options = buildRankedOptions({
    correctAnswer: resolvedCorrectAnswer,
    optionPrefix: `${variant}-${item.wordProgressId}`,
    storedAnswerSet: variant === "synonym" ? answerSet : null,
    poolCandidates: optionPool,
    fallbackCandidates:
      variant === "antonym"
        ? [...synonymCandidates, ...item.distractors]
        : [...item.distractors, ...getMeaningCandidatePool(item, allItems)],
  });

  return {
    id: `${item.wordProgressId}:synonym${variant === "antonym" ? ":antonym" : ""}`,
    type: "synonym",
    prompt:
      variant === "antonym" ? "Choose the opposite meaning." : "Choose the closest substitute.",
    instructions:
      variant === "antonym"
        ? item.itemType === "phrase"
          ? "Pick the option with the opposite meaning from the phrase."
          : "Pick the option with the clearest opposite meaning."
        : item.itemType === "phrase"
          ? "Pick the option that could replace the phrase without changing the meaning too much."
          : "Pick the option with the closest meaning or best substitute.",
    target_word: item.itemText,
    target_word_id: item.vocabularyItemId,
    targetWord: item.itemText,
    targetWordId: item.vocabularyItemId,
    question_text: questionText,
    questionText,
    sentence_text: sentenceText,
    sentenceText: sentenceText,
    options,
    correct_answer: "correct",
    correctAnswer: "correct",
    drill_correct_answer: resolvedCorrectAnswer,
    drillCorrectAnswer: resolvedCorrectAnswer,
    acceptable_answers: ["correct"],
    acceptableAnswers: ["correct"],
    distractors:
      variant === "antonym"
        ? uniqueNonEmpty([...synonymCandidates, ...item.distractors]).slice(0, 4)
        : uniqueNonEmpty([...(answerSet?.distractors ?? []), ...item.distractors]).slice(0, 4),
    explanation:
      variant === "antonym"
        ? `The best antonym is "${resolvedCorrectAnswer}".`
        : `Closest substitute meaning: ${resolvedCorrectAnswer}`,
    modality: "text",
    difficulty_band: "hard",
    metadata: {
      source_drill_id: item.wordProgressId,
      source_item_type: item.itemType,
      source_sentence: sentenceText,
      prompt_sentence_source: preferredPracticeSentence.source,
      candidate_pool_source:
        variant === "antonym"
          ? "stored_antonyms_plus_captured_pool"
          : "stored_synonyms_plus_captured_pool",
    },
    tags:
      variant === "antonym"
        ? [item.itemType, "substitution", "opposites", "antonym"]
        : [item.itemType, "substitution", "meaning", "synonym"],
    skill: "synonym",
    answerSet: answerSet ?? undefined,
    promptStyle:
      variant === "antonym"
        ? "best_antonym"
        : item.itemType === "phrase"
          ? "closest_meaning"
          : "best_synonym",
    variant,
    reviewMeta: {
      sourceDrillId: item.wordProgressId,
      ...buildSourceReviewMeta(item),
    },
  };
}

export function adaptSynonymDrillsToExercises(
  items: Array<MeaningDrillItem | ClozeDrillItem>
): SupportedVocabExercise[] {
  return items.flatMap((item) => {
    const antonymCandidates = getAntonymCandidates(item);

    return [
      adaptSynonymDrillToExercise(item, items, "synonym"),
      ...(antonymCandidates.length > 0
        ? [adaptSynonymDrillToExercise(item, items, "antonym")]
        : []),
    ];
  });
}

export function adaptCollocationDrillToExercise(
  item: MeaningDrillItem | ClozeDrillItem,
  allItems: Array<MeaningDrillItem | ClozeDrillItem>
): CollocationVocabExercise | null {
  const sourceSentence = getSourceSentence(item);
  if (!sourceSentence) {
    return null;
  }

  const answerSet = getStoredAnswerSet(item, "collocation");
  const stem = makeBlank(sourceSentence, item.itemText);
  const correctCollocation = answerSet?.drill_correct_answer ?? item.itemText;
  const plainMeaning = getPlainMeaning(item);

  return {
    id: `${item.wordProgressId}:collocation`,
    type: "collocation",
    prompt: "Choose the most natural phrase partner.",
    instructions:
      "Use the source sentence to choose the word or phrase that creates the most natural English collocation.",
    target_word: item.itemText,
    target_word_id: item.vocabularyItemId,
    targetWord: item.itemText,
    targetWordId: item.vocabularyItemId,
    question_text: `Which option best restores the natural phrase in the sentence?`,
    questionText: `Which option best restores the natural phrase in the sentence?`,
    sentence_text: stem,
    sentenceText: stem,
    options: answerSet
      ? buildStoredAnswerSetOptions(answerSet, `collocation-${item.wordProgressId}`)
      : buildLexicalOptions(item, allItems, `collocation-${item.wordProgressId}`),
    correct_answer: "correct",
    correctAnswer: "correct",
    drill_correct_answer: correctCollocation,
    drillCorrectAnswer: correctCollocation,
    acceptable_answers: ["correct"],
    acceptableAnswers: ["correct"],
    distractors: answerSet?.distractors ?? item.distractors,
    explanation: `The natural phrase in the source sentence uses "${correctCollocation}", meaning ${plainMeaning}.`,
    modality: "mixed",
    difficulty_band: "hard",
    metadata: {
      source_drill_id: item.wordProgressId,
      source_item_type: item.itemType,
      source_sentence: sourceSentence,
    },
    tags: [item.itemType, "phrase_building", "collocation"],
    skill: "collocation",
    answerSet: answerSet ?? undefined,
    stem,
    exampleSentence: sourceSentence,
    variant: "best_fit",
    reviewMeta: {
      sourceDrillId: item.wordProgressId,
      ...buildSourceReviewMeta(item),
    },
  };
}

function extractCollocationLead(sourceSentence: string, itemText: string) {
  const pattern = new RegExp(`([A-Za-z'-]+)\\s+${escapeRegExp(itemText)}`, "i");
  const match = sourceSentence.match(pattern);
  return match?.[1] ?? null;
}

export function adaptCollocationDrillsToExercises(
  items: Array<MeaningDrillItem | ClozeDrillItem>
): SupportedVocabExercise[] {
  return items.flatMap((item) => {
    const base = adaptCollocationDrillToExercise(item, items);
    if (!base) {
      return [];
    }

    const sourceSentence = getSourceSentence(item);
    const pairLead = extractCollocationLead(sourceSentence, item.itemText);

    if (!pairLead) {
      return [base];
    }

    return [
      base,
      {
        ...base,
        id: `${item.wordProgressId}:collocation:pair_selection`,
        question_text: `Which option best completes the natural pair "${pairLead} ____"?`,
        questionText: `Which option best completes the natural pair "${pairLead} ____"?`,
        instructions:
          "Focus on the natural English pairing first, then confirm it against the example sentence.",
        variant: "pair_selection",
        pairLead,
        tags: [...(base.tags ?? []), "pair_selection"],
      },
    ];
  });
}
