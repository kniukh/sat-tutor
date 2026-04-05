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

function getTranslationCandidatePool(
  item: MeaningDrillItem | ClozeDrillItem,
  allItems: Array<MeaningDrillItem | ClozeDrillItem>
) {
  return allItems
    .filter((candidate) => candidate.vocabularyItemId !== item.vocabularyItemId)
    .flatMap((candidate) => [
      getStoredAnswerSet(candidate, "translation_english_to_native")?.drill_correct_answer,
      getTranslatedMeaning(candidate),
    ]);
}

function buildTranslationOptions(
  item: MeaningDrillItem | ClozeDrillItem,
  allItems: Array<MeaningDrillItem | ClozeDrillItem>,
  optionPrefix: string
) {
  const translatedDistractors = uniqueNonEmpty(
    allItems
      .filter((candidate) => candidate.vocabularyItemId !== item.vocabularyItemId)
      .map((candidate) => getTranslatedMeaning(candidate))
  )
    .filter((candidate) => candidate.toLowerCase() !== (getTranslatedMeaning(item) ?? "").toLowerCase())
    .slice(0, 3);

  return shuffle([
    { id: "correct", label: getTranslatedMeaning(item) ?? getPlainMeaning(item) },
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
  const anchorItem = params.pairEntries[0]?.item;
  if (!anchorItem) {
    return null;
  }

  const pairRecords = params.pairEntries.map((entry, index) => ({
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
    params.pairEntries.map((entry) => entry.item.vocabularyItemId)
  );
  const pairWords = uniqueNonEmpty(params.pairEntries.map((entry) => entry.item.itemText));

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
  const questionText =
    item.itemType === "phrase"
      ? `Which option best paraphrases "${item.itemText}"?`
      : `Which option best defines "${item.itemText}"?`;
  const options = buildMeaningOptions(item, `distractor-${item.vocabularyItemId}`);
  const metadata = {
    source_drill_id: item.wordProgressId,
    source_item_type: item.itemType,
  };
  const plainMeaning = getPlainMeaning(item);

  return {
    id: `${item.wordProgressId}:meaning_match`,
    type: "meaning_match",
    prompt:
      item.itemType === "phrase"
        ? "Choose the best paraphrase."
        : "Choose the best meaning.",
    instructions:
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
    explanation: `${buildExplanationPrefix(item.itemType)}: ${plainMeaning}`,
    modality: "text",
    difficulty_band: "easy",
    metadata,
    tags: [item.itemType, "review"],
    skill: item.itemType === "phrase" ? "phrase_paraphrase" : "word_meaning",
    sourceLanguageLabel: "English",
    targetLanguageLabel: "Meaning",
    variant: item.itemType === "phrase" ? "paraphrase_match" : "definition_match",
    reviewMeta: {
      sourceDrillId: item.wordProgressId,
      ...buildSourceReviewMeta(item),
    },
  };
}

export function adaptMeaningDrillsToExercises(
  items: MeaningDrillItem[]
): SupportedVocabExercise[] {
  return items.flatMap((item) => [
    adaptMeaningDrillToExercise(item),
    ...adaptTranslationDrillToExercises(item, items),
  ]);
}

export function adaptTranslationDrillToExercises(
  item: MeaningDrillItem,
  allItems: MeaningDrillItem[]
): TranslationMatchVocabExercise[] {
  const translatedMeaning = getTranslatedMeaning(item);
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
  const definitionGroups = chunkItemsBalanced(items, 6, 8, 4);

  exercises.push(
    ...definitionGroups
      .map((group, index) =>
        buildPairMatchExercise({
          id: `${group[0]?.wordProgressId ?? index}:pair_match:word_definition:${index + 1}`,
          pairEntries: group.map((item) => ({
            item,
            left: item.itemText,
            right: getPlainMeaning(item),
          })),
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

  const translationGroups = chunkItemsBalanced(
    items.filter((item) => Boolean(getTranslatedMeaning(item))),
    6,
    8,
    4
  );

  exercises.push(
    ...translationGroups
      .map((group, index) =>
        buildPairMatchExercise({
          id: `${group[0]?.wordProgressId ?? index}:pair_match:english_native:${index + 1}`,
          pairEntries: group.map((item) => ({
            item,
            left: item.itemText,
            right: getTranslatedMeaning(item) ?? getPlainMeaning(item),
          })),
          prompt: "Match the translations.",
          instructions: "Tap the English word, then tap its translation.",
          questionText: "Match each English word to its translation.",
          explanation: "Use the closest translation for each word.",
          variant: "english_native",
          leftColumnLabel: "English",
          rightColumnLabel:
            translationGroups[index]?.[0]?.translationLanguage?.toUpperCase() ?? "Native",
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
  const options = answerSet
    ? buildStoredAnswerSetOptions(answerSet, `fill-blank-${item.wordProgressId}`)
    : buildLexicalOptions(item, allItems, `fill-blank-${item.wordProgressId}`);
  const drillCorrectAnswer = answerSet?.drill_correct_answer ?? item.itemText;
  const plainMeaning = getPlainMeaning(item);
  const metadata = {
    source_drill_id: item.wordProgressId,
    source_item_type: item.itemType,
    source_context_sentence: item.contextSentence,
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
  const anchorItem = params.items[0];
  if (!anchorItem) {
    return null;
  }

  const pairRecords = params.items.map((item, index) => ({
    id: `pair-${index + 1}`,
    left: `Audio ${index + 1}`,
    right:
      params.variant === "translation"
        ? getTranslatedMeaning(item) ?? getPlainMeaning(item)
        : params.variant === "english"
          ? item.itemText
        : getPlainMeaning(item),
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
      pair_target_word_ids: uniqueNonEmpty(params.items.map((item) => item.vocabularyItemId)),
      pair_target_words: uniqueNonEmpty(params.items.map((item) => item.itemText)),
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
  const englishGroups = chunkItemsBalanced(audioReadyItems, 8, 10, 4);
  const meaningGroups = chunkItemsBalanced(audioReadyItems, 8, 10, 4);
  const translationGroups = chunkItemsBalanced(
    audioReadyItems.filter((item) => Boolean(getTranslatedMeaning(item))),
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
  const contextText = getSourceSentence(item);
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
  item: MeaningDrillItem | ClozeDrillItem
): SynonymVocabExercise {
  const answerSet = getStoredAnswerSet(item, "synonym");
  const questionText =
    item.itemType === "phrase"
      ? `Which option is the closest substitute for "${item.itemText}"?`
      : `Which option is the closest synonym or substitute for "${item.itemText}"?`;
  const sentenceText = getSourceSentence(item) || null;
  const plainMeaning = answerSet?.drill_correct_answer ?? getPlainMeaning(item);

  return {
    id: `${item.wordProgressId}:synonym`,
    type: "synonym",
    prompt: "Choose the closest substitute.",
    instructions:
      item.itemType === "phrase"
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
    options: answerSet
      ? buildStoredAnswerSetOptions(answerSet, `synonym-${item.wordProgressId}`)
      : buildMeaningOptions(item, `synonym-${item.wordProgressId}`),
    correct_answer: "correct",
    correctAnswer: "correct",
    drill_correct_answer: plainMeaning,
    drillCorrectAnswer: plainMeaning,
    acceptable_answers: ["correct"],
    acceptableAnswers: ["correct"],
    distractors: answerSet?.distractors ?? item.distractors,
    explanation: `Closest substitute meaning: ${plainMeaning}`,
    modality: "text",
    difficulty_band: "hard",
    metadata: {
      source_drill_id: item.wordProgressId,
      source_item_type: item.itemType,
      source_sentence: sentenceText,
    },
    tags: [item.itemType, "substitution", "meaning"],
    skill: "synonym",
    answerSet: answerSet ?? undefined,
    promptStyle: item.itemType === "phrase" ? "closest_meaning" : "best_synonym",
    variant: "synonym",
    reviewMeta: {
      sourceDrillId: item.wordProgressId,
      ...buildSourceReviewMeta(item),
    },
  };
}

export function adaptSynonymDrillsToExercises(
  items: Array<MeaningDrillItem | ClozeDrillItem>
): SupportedVocabExercise[] {
  return items.map(adaptSynonymDrillToExercise);
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
