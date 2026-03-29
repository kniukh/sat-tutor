import type { SupportedVocabExercise } from "@/types/vocab-exercises";

export type MeaningDrillItem = {
  wordProgressId: string;
  vocabularyItemId: string;
  itemText: string;
  itemType: "word" | "phrase";
  correctAnswer: string;
  distractors: string[];
};

export type ClozeDrillItem = {
  wordProgressId: string;
  vocabularyItemId: string;
  itemText: string;
  itemType: "word" | "phrase";
  contextSentence: string;
  correctAnswer: string;
  distractors: string[];
};

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

export function adaptMeaningDrillToExercise(
  item: MeaningDrillItem
): SupportedVocabExercise {
  const questionText =
    item.itemType === "phrase"
      ? `Which option best paraphrases "${item.itemText}"?`
      : `Which option best defines "${item.itemText}"?`;
  const options = shuffle([
    { id: "correct", label: item.correctAnswer },
    ...(item.distractors ?? []).slice(0, 3).map((label, index) => ({
      id: `distractor-${item.vocabularyItemId}-${index}`,
      label,
    })),
  ]);
  const metadata = {
    source_drill_id: item.wordProgressId,
    source_item_type: item.itemType,
  };

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
    explanation: `Correct answer: ${item.correctAnswer}`,
    modality: "text",
    difficulty_band: null,
    metadata,
    tags: [item.itemType, "review"],
    skill: item.itemType === "phrase" ? "phrase_paraphrase" : "word_meaning",
    reviewMeta: {
      sourceDrillId: item.wordProgressId,
    },
  };
}

export function adaptMeaningDrillsToExercises(
  items: MeaningDrillItem[]
): SupportedVocabExercise[] {
  return items.map(adaptMeaningDrillToExercise);
}

export function adaptClozeDrillToExercise(item: ClozeDrillItem): SupportedVocabExercise {
  const questionText = `Which option best completes the sentence for "${item.itemText}"?`;
  const sentenceText = makeBlank(item.contextSentence, item.itemText);
  const options = shuffle([
    { id: "correct", label: item.correctAnswer },
    ...(item.distractors ?? []).slice(0, 3).map((label, index) => ({
      id: `distractor-${item.wordProgressId}-${index}`,
      label,
    })),
  ]);
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
    explanation: `Correct answer: ${item.correctAnswer}`,
    modality: "context",
    difficulty_band: null,
    metadata,
    skill: "fill_blank",
    tags: [item.itemType, "context", "cloze"],
    reviewMeta: {
      sourceDrillId: item.wordProgressId,
    },
  };
}

export function adaptClozeDrillsToExercises(
  items: ClozeDrillItem[]
): SupportedVocabExercise[] {
  return items.map(adaptClozeDrillToExercise);
}
