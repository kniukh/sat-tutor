import type { SupportedVocabExercise } from "@/types/vocab-exercises";

export type MeaningDrillItem = {
  wordProgressId: string;
  vocabularyItemId: string;
  itemText: string;
  itemType: "word" | "phrase";
  correctAnswer: string;
  distractors: string[];
  plainMeaning?: string;
  contextSentence?: string;
  exampleText?: string;
  audioUrl?: string | null;
  audioStatus?: "ready" | "pending" | "failed" | "missing" | null;
  sourceLessonId?: string | null;
  sourceLessonTitle?: string | null;
  sourceContextSnippet?: string | null;
  sourceCapturedAt?: string | null;
};

export type ClozeDrillItem = {
  wordProgressId: string;
  vocabularyItemId: string;
  itemText: string;
  itemType: "word" | "phrase";
  contextSentence: string;
  correctAnswer: string;
  distractors: string[];
  plainMeaning?: string;
  exampleText?: string;
  audioUrl?: string | null;
  audioStatus?: "ready" | "pending" | "failed" | "missing" | null;
  sourceLessonId?: string | null;
  sourceLessonTitle?: string | null;
  sourceContextSnippet?: string | null;
  sourceCapturedAt?: string | null;
};

function buildSourceReviewMeta(item: MeaningDrillItem | ClozeDrillItem) {
  return {
    sourceLessonId: item.sourceLessonId ?? null,
    sourceLessonTitle: item.sourceLessonTitle ?? null,
    sourceContextSnippet:
      item.sourceContextSnippet ?? getSourceSentence(item) ?? null,
    sourceCapturedAt: item.sourceCapturedAt ?? null,
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

function getSourceSentence(item: MeaningDrillItem | ClozeDrillItem) {
  return item.contextSentence || item.exampleText || "";
}

function uniqueNonEmpty(items: Array<string | null | undefined>) {
  return Array.from(
    new Set(items.map((item) => item?.trim()).filter((item): item is string => Boolean(item)))
  );
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

function buildLexicalOptions(
  item: MeaningDrillItem | ClozeDrillItem,
  allItems: Array<MeaningDrillItem | ClozeDrillItem>,
  optionPrefix: string
) {
  const lexicalDistractors = uniqueNonEmpty([
    ...allItems
      .filter((candidate) => candidate.vocabularyItemId !== item.vocabularyItemId)
      .map((candidate) => candidate.itemText),
    ...(item.distractors ?? []),
  ])
    .filter((candidate) => candidate.toLowerCase() !== item.itemText.toLowerCase())
    .slice(0, 3);

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

export function adaptMeaningDrillToExercise(
  item: MeaningDrillItem
): SupportedVocabExercise {
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
    acceptable_answers: ["correct"],
    acceptableAnswers: ["correct"],
    distractors: item.distractors,
    explanation: `${buildExplanationPrefix(item.itemType)}: ${plainMeaning}`,
    modality: "text",
    difficulty_band: "easy",
    metadata,
    tags: [item.itemType, "review"],
    skill: item.itemType === "phrase" ? "phrase_paraphrase" : "word_meaning",
    reviewMeta: {
      sourceDrillId: item.wordProgressId,
      ...buildSourceReviewMeta(item),
    },
  };
}

export function adaptMeaningDrillsToExercises(
  items: MeaningDrillItem[]
): SupportedVocabExercise[] {
  return items.map(adaptMeaningDrillToExercise);
}

export function adaptClozeDrillToExercise(item: ClozeDrillItem): SupportedVocabExercise {
  return adaptClozeDrillToExerciseWithPool(item, [item]);
}

export function adaptClozeDrillToExerciseWithPool(
  item: ClozeDrillItem,
  allItems: ClozeDrillItem[]
): SupportedVocabExercise {
  const questionText = `Which option best completes the sentence for "${item.itemText}"?`;
  const sentenceText = makeBlank(item.contextSentence, item.itemText);
  const options = buildLexicalOptions(item, allItems, `distractor-${item.wordProgressId}`);
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
    acceptable_answers: ["correct"],
    acceptableAnswers: ["correct"],
    distractors: item.distractors,
    explanation: `"${item.itemText}" fits this context because it means ${plainMeaning}.`,
    modality: "context",
    difficulty_band: "medium",
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
  return items.map((item) => adaptClozeDrillToExerciseWithPool(item, items));
}

export function adaptListenMatchDrillToExercise(
  item: MeaningDrillItem | ClozeDrillItem,
  allItems: Array<MeaningDrillItem | ClozeDrillItem>
): SupportedVocabExercise {
  const sourceSentence = getSourceSentence(item);
  const plainMeaning = getPlainMeaning(item);

  return {
    id: `${item.wordProgressId}:listen_match`,
    type: "listen_match",
    prompt: "Listen and match the word.",
    instructions:
      "Play the audio, then choose the word or phrase you heard from the answer bank.",
    target_word: item.itemText,
    target_word_id: item.vocabularyItemId,
    targetWord: item.itemText,
    targetWordId: item.vocabularyItemId,
    question_text: "Which option matches the audio?",
    questionText: "Which option matches the audio?",
    sentence_text: sourceSentence || null,
    sentenceText: sourceSentence || null,
    options: buildLexicalOptions(item, allItems, `listen-${item.wordProgressId}`),
    correct_answer: "correct",
    correctAnswer: "correct",
    acceptable_answers: ["correct"],
    acceptableAnswers: ["correct"],
    distractors: item.distractors,
    explanation: `You heard "${item.itemText}", which means ${plainMeaning}.`,
    modality: "audio",
    difficulty_band: "easy",
    metadata: {
      source_drill_id: item.wordProgressId,
      source_item_type: item.itemType,
      source_sentence: sourceSentence || null,
      audio_url: item.audioUrl ?? null,
      audio_status: item.audioStatus ?? "missing",
    },
    tags: [item.itemType, "audio", "recognition"],
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

export function adaptListenMatchDrillsToExercises(
  items: Array<MeaningDrillItem | ClozeDrillItem>
): SupportedVocabExercise[] {
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

export function adaptContextMeaningDrillToExercise(
  item: MeaningDrillItem | ClozeDrillItem
): SupportedVocabExercise | null {
  const contextText = getSourceSentence(item);
  if (!contextText) {
    return null;
  }

  const questionText =
    item.itemType === "phrase"
      ? `What does "${item.itemText}" mean in this sentence?`
      : `What does "${item.itemText}" mean in this sentence?`;
  const plainMeaning = getPlainMeaning(item);

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
    options: buildMeaningOptions(item, `context-${item.wordProgressId}`),
    correct_answer: "correct",
    correctAnswer: "correct",
    acceptable_answers: ["correct"],
    acceptableAnswers: ["correct"],
    distractors: item.distractors,
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
): SupportedVocabExercise {
  const questionText =
    item.itemType === "phrase"
      ? `Which option is the closest substitute for "${item.itemText}"?`
      : `Which option is the closest synonym or substitute for "${item.itemText}"?`;
  const sentenceText = getSourceSentence(item) || null;
  const plainMeaning = getPlainMeaning(item);

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
    options: buildMeaningOptions(item, `synonym-${item.wordProgressId}`),
    correct_answer: "correct",
    correctAnswer: "correct",
    acceptable_answers: ["correct"],
    acceptableAnswers: ["correct"],
    distractors: item.distractors,
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
    promptStyle: item.itemType === "phrase" ? "closest_meaning" : "best_synonym",
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
): SupportedVocabExercise | null {
  const sourceSentence = getSourceSentence(item);
  if (!sourceSentence) {
    return null;
  }

  const stem = makeBlank(sourceSentence, item.itemText);
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
    options: buildLexicalOptions(item, allItems, `collocation-${item.wordProgressId}`),
    correct_answer: "correct",
    correctAnswer: "correct",
    acceptable_answers: ["correct"],
    acceptableAnswers: ["correct"],
    distractors: item.distractors,
    explanation: `The natural phrase in the source sentence uses "${item.itemText}", meaning ${plainMeaning}.`,
    modality: "mixed",
    difficulty_band: "hard",
    metadata: {
      source_drill_id: item.wordProgressId,
      source_item_type: item.itemType,
      source_sentence: sourceSentence,
    },
    tags: [item.itemType, "phrase_building", "collocation"],
    skill: "collocation",
    stem,
    exampleSentence: sourceSentence,
    reviewMeta: {
      sourceDrillId: item.wordProgressId,
      ...buildSourceReviewMeta(item),
    },
  };
}

export function adaptCollocationDrillsToExercises(
  items: Array<MeaningDrillItem | ClozeDrillItem>
): SupportedVocabExercise[] {
  return items
    .map((item) => adaptCollocationDrillToExercise(item, items))
    .filter((exercise): exercise is SupportedVocabExercise => Boolean(exercise));
}
