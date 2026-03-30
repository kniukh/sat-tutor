export const VOCABULARY_DRILL_ANSWER_SET_KEYS = [
  "translation_english_to_native",
  "translation_native_to_english",
  "synonym",
  "context_meaning",
  "collocation",
] as const;

export type VocabularyDrillAnswerSetKey =
  (typeof VOCABULARY_DRILL_ANSWER_SET_KEYS)[number];

export type VocabularyAnswerPartOfSpeech =
  | "noun"
  | "verb"
  | "adjective"
  | "adverb"
  | "phrase"
  | "unknown";

export type VocabularyAnswerDifficultyBand = "easy" | "medium" | "hard";

export type VocabularyAnswerStyle =
  | "single_word"
  | "infinitive"
  | "short_phrase"
  | "clause_like";

export type VocabularyDrillAnswerNormalization = {
  part_of_speech: VocabularyAnswerPartOfSpeech;
  difficulty_band: VocabularyAnswerDifficultyBand;
  style: VocabularyAnswerStyle;
  token_count: number;
  character_length: number;
};

export type VocabularyDrillAnswerSet = {
  drill_type: VocabularyDrillAnswerSetKey;
  drill_correct_answer: string;
  distractors: string[];
  normalization: VocabularyDrillAnswerNormalization;
};

export type VocabularyDrillAnswerSetMap = Partial<
  Record<VocabularyDrillAnswerSetKey, VocabularyDrillAnswerSet>
>;
