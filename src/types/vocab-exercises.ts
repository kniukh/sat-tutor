import type {
  VocabDifficultyBand,
  VocabModality,
  WordLifecycleState,
} from "@/types/vocab-tracking";
import type { VocabularyDrillAnswerSet } from "@/types/vocabulary-answer-sets";

export type SupportedVocabExerciseType =
  | "meaning_match"
  | "translation_match"
  | "pair_match"
  | "listen_match"
  | "spelling_from_audio"
  | "sentence_builder"
  | "error_detection"
  | "fill_blank"
  | "context_meaning"
  | "synonym"
  | "collocation";

export type FutureVocabExerciseType =
  | "spelling"
  | "memory"
  | "speed_round";

export type VocabExerciseType =
  | SupportedVocabExerciseType
  | FutureVocabExerciseType;

export type VocabExerciseOption = {
  id: string;
  label: string;
};

export type VocabExerciseModality =
  | "text"
  | "context"
  | "audio"
  | "memory"
  | "mixed";

export type VocabExerciseDifficultyBand = "easy" | "medium" | "hard";

export type VocabExercisePair = {
  id: string;
  left: string;
  right: string;
  left_id?: string;
  leftId?: string;
  right_id?: string;
  rightId?: string;
  left_audio_url?: string | null;
  leftAudioUrl?: string | null;
  left_kind?: "text" | "audio";
  leftKind?: "text" | "audio";
};

export type VocabExerciseQueueBucket =
  | "recently_failed"
  | "weak_again"
  | "overdue"
  | "reinforcement"
  | "scheduled";

export type VocabExerciseSourceType =
  | "reading_lesson"
  | "generated_lesson"
  | "other";

export type VocabularySessionPhase = "priority_review" | "endless_continuation";

export type VocabularyContinuationSourceBucket =
  | "due_review"
  | "weak_reinforcement"
  | "learning_reinforcement"
  | "mixed_continuation"
  | "retention_check";

export type VocabExerciseReviewMeta = {
  attemptCount?: number;
  streak?: number;
  dueAt?: string | null;
  lastReviewedAt?: string | null;
  sourceLessonId?: string | null;
  sourceLessonTitle?: string | null;
  sourcePassageTitle?: string | null;
  sourceContextSnippet?: string | null;
  sourceCapturedAt?: string | null;
  sourceType?: VocabExerciseSourceType | null;
  sourceOrigin?: "lesson_capture" | "review_queue" | "new_word_pool" | "unknown";
  lessonFirstExposure?: boolean;
  sourceDrillId?: string | null;
  queueBucket?: VocabExerciseQueueBucket;
  queueReason?: string | null;
  queuePriorityScore?: number | null;
  lifecycleState?: WordLifecycleState | null;
  masteryScore?: number | null;
  lastModality?: VocabModality | null;
  recommendedModality?: VocabModality | null;
  consecutiveIncorrect?: number;
  selectionBucket?: "weak_recent" | "reinforcement" | "newer_words" | "retention_check";
  selectionRule?: string | null;
  selectionReason?: string | null;
  preferredModality?: VocabModality | null;
  selectionScore?: number | null;
  adaptiveDifficultyBand?: VocabDifficultyBand | null;
  adaptiveDifficultyReason?: string | null;
  sessionDifficultyBias?: "supportive" | "balanced" | "stretch";
  sessionPhase?: VocabularySessionPhase;
  extendedPracticeMode?: boolean;
  continuationSourceBucket?: VocabularyContinuationSourceBucket | null;
  recentAccuracy?: number | null;
  averageResponseTimeMs?: number | null;
  strongestModality?: VocabModality | null;
  weakestModality?: VocabModality | null;
};

export type VocabExerciseMetadata = Record<string, unknown>;

type VocabExerciseBase<TType extends VocabExerciseType> = {
  id: string;
  type: TType;
  prompt: string;
  instructions?: string;
  options: VocabExerciseOption[];
  distractors: string[];
  pairs?: VocabExercisePair[];
  explanation?: string;
  modality?: VocabExerciseModality;
  difficulty_band?: VocabExerciseDifficultyBand | null;
  metadata?: VocabExerciseMetadata;
  target_word?: string;
  target_word_id?: string;
  question_text?: string;
  sentence_text?: string | null;
  correct_answer?: string;
  drill_correct_answer?: string;
  acceptable_answers?: string[];
  targetWord?: string;
  targetWordId?: string;
  questionText?: string;
  sentenceText?: string | null;
  correctAnswer?: string;
  drillCorrectAnswer?: string;
  acceptableAnswers?: string[];
  difficulty?: number;
  tags?: string[];
  skill?: string;
  reviewMeta?: VocabExerciseReviewMeta;
  answerSet?: VocabularyDrillAnswerSet;
};

type AudioBackedExerciseFields = {
  audioAssetId?: string;
  audio_url?: string | null;
  audioUrl?: string | null;
  audio_status?: "ready" | "pending" | "failed" | "missing" | null;
  audioStatus?: "ready" | "pending" | "failed" | "missing" | null;
};

// Shared normalized contract for current vocab drills.
export type MeaningMatchVocabExercise = VocabExerciseBase<"meaning_match"> & {
  sourceLanguageLabel?: string;
  targetLanguageLabel?: string;
  variant?: "definition_match" | "paraphrase_match";
};

export type TranslationMatchVocabExercise = VocabExerciseBase<"translation_match"> & {
  sourceLanguageLabel?: string;
  targetLanguageLabel?: string;
  translationLanguageLabel?: string | null;
  direction?: "english_to_native" | "native_to_english";
  promptTerm?: string;
};

export type PairMatchVocabExercise = VocabExerciseBase<"pair_match"> & {
  leftColumnLabel?: string;
  left_column_label?: string;
  rightColumnLabel?: string;
  right_column_label?: string;
  variant?:
    | "english_native"
    | "native_english"
    | "word_definition"
    | "synonym_pair"
    | "collocation_pair";
};

export type FillBlankVocabExercise = VocabExerciseBase<"fill_blank"> & {
  clue?: string;
  variant?: "single_blank" | "context_clue";
  contextHint?: string | null;
};

export type ContextMeaningVocabExercise = VocabExerciseBase<"context_meaning"> & {
  focusText: string;
  contextText: string;
};

export type SynonymVocabExercise = VocabExerciseBase<"synonym"> & {
  promptStyle?: "closest_meaning" | "best_synonym" | "best_antonym";
  variant?: "synonym" | "antonym";
};

export type CollocationVocabExercise = VocabExerciseBase<"collocation"> & {
  stem: string;
  exampleSentence?: string;
  variant?: "best_fit" | "pair_selection";
  pairLead?: string;
};

export type SentenceBuilderVocabExercise = VocabExerciseBase<"sentence_builder"> & {
  correct_sequence: string[];
  correctSequence?: string[];
  tileStyle?: "word_bank" | "phrase_bank";
  clue?: string | null;
};

export type ErrorDetectionSentenceSegment = {
  id: string;
  text: string;
};

export type ErrorDetectionVocabExercise = VocabExerciseBase<"error_detection"> & {
  sentence_segments: ErrorDetectionSentenceSegment[];
  sentenceSegments?: ErrorDetectionSentenceSegment[];
  replacement_text?: string | null;
  replacementText?: string | null;
  allow_no_error?: boolean;
  allowNoError?: boolean;
  variant?: "find_error" | "no_error_possible";
};

// Future placeholders keep the contract ready without forcing implementation details yet.
export type ListenMatchVocabExercise = VocabExerciseBase<"listen_match"> &
  AudioBackedExerciseFields & {
    variant?: "english" | "meaning" | "translation";
    promptStyle?: "best_word" | "best_meaning" | "best_translation";
    translationLanguageLabel?: string | null;
    leftColumnLabel?: string;
    left_column_label?: string;
    rightColumnLabel?: string;
    right_column_label?: string;
  };

export type SpellingFromAudioVocabExercise =
  VocabExerciseBase<"spelling_from_audio"> &
    AudioBackedExerciseFields & {
      placeholder?: string;
      inputLabel?: string;
    };

export type SpellingVocabExercise = VocabExerciseBase<"spelling"> & {
  maskedWord?: string;
};

export type MemoryVocabExercise = VocabExerciseBase<"memory"> & {
  memorySetId?: string;
};

export type SpeedRoundVocabExercise = VocabExerciseBase<"speed_round"> & {
  timeLimitMs?: number;
};

export type SupportedVocabExercise =
  | MeaningMatchVocabExercise
  | TranslationMatchVocabExercise
  | PairMatchVocabExercise
  | ListenMatchVocabExercise
  | SpellingFromAudioVocabExercise
  | SentenceBuilderVocabExercise
  | ErrorDetectionVocabExercise
  | FillBlankVocabExercise
  | ContextMeaningVocabExercise
  | SynonymVocabExercise
  | CollocationVocabExercise;

export type VocabExercise =
  | SupportedVocabExercise
  | ListenMatchVocabExercise
  | SpellingVocabExercise
  | MemoryVocabExercise
  | SpeedRoundVocabExercise;

export type VocabExerciseAttemptMetadata = Record<string, unknown>;

export type VocabExerciseResult = {
  response_time_ms: number;
  session_id: string;
  exercise_id: string;
  exercise_type: SupportedVocabExerciseType;
  target_word_id: string;
  target_word: string;
  selected_answer: string;
  correct_answer: string;
  is_correct: boolean;
  attempt_index: number;
  word_progress_id: string | null;
  metadata: VocabExerciseAttemptMetadata;
  user_answer: string;
  attempt_count: number;
  lesson_id: string | null;
  confidence: number | null;
  created_at: string;
};

export function getExerciseTargetWord(exercise: VocabExerciseBase<VocabExerciseType>) {
  return exercise.target_word ?? exercise.targetWord ?? "";
}

export function getExerciseTargetWordId(exercise: VocabExerciseBase<VocabExerciseType>) {
  return exercise.target_word_id ?? exercise.targetWordId ?? "";
}

export function getExerciseQuestionText(exercise: VocabExerciseBase<VocabExerciseType>) {
  return exercise.question_text ?? exercise.questionText ?? "";
}

export function getExerciseSentenceText(exercise: VocabExerciseBase<VocabExerciseType>) {
  return exercise.sentence_text ?? exercise.sentenceText ?? "";
}

export function getExerciseCorrectAnswer(exercise: VocabExerciseBase<VocabExerciseType>) {
  return exercise.correct_answer ?? exercise.correctAnswer ?? "";
}

export function getExerciseDrillCorrectAnswer(exercise: VocabExerciseBase<VocabExerciseType>) {
  return exercise.drill_correct_answer ?? exercise.drillCorrectAnswer ?? "";
}

export function getExerciseAcceptableAnswers(exercise: VocabExerciseBase<VocabExerciseType>) {
  return exercise.acceptable_answers ?? exercise.acceptableAnswers ?? [];
}

export function getExerciseModality(exercise: VocabExerciseBase<VocabExerciseType>) {
  return exercise.modality ?? "text";
}

export function getExerciseDifficultyBand(exercise: VocabExerciseBase<VocabExerciseType>) {
  return exercise.difficulty_band ?? null;
}

export function getExercisePairs(exercise: VocabExerciseBase<VocabExerciseType>) {
  return exercise.pairs ?? [];
}

export function getExercisePairLeftId(pair: VocabExercisePair) {
  return pair.left_id ?? pair.leftId ?? `${pair.id}:left`;
}

export function getExercisePairRightId(pair: VocabExercisePair) {
  return pair.right_id ?? pair.rightId ?? `${pair.id}:right`;
}

export function getExerciseCorrectSequence(exercise: VocabExerciseBase<VocabExerciseType>) {
  if ("correct_sequence" in exercise || "correctSequence" in exercise) {
    return (
      (exercise as SentenceBuilderVocabExercise).correct_sequence ??
      (exercise as SentenceBuilderVocabExercise).correctSequence ??
      []
    );
  }

  return [];
}

export function getExerciseSentenceSegments(exercise: VocabExerciseBase<VocabExerciseType>) {
  if ("sentence_segments" in exercise || "sentenceSegments" in exercise) {
    return (
      (exercise as ErrorDetectionVocabExercise).sentence_segments ??
      (exercise as ErrorDetectionVocabExercise).sentenceSegments ??
      []
    );
  }

  return [];
}

export function getExerciseAudioUrl(exercise: VocabExerciseBase<VocabExerciseType>) {
  if ("audio_url" in exercise || "audioUrl" in exercise) {
    return (
      (exercise as ListenMatchVocabExercise | SpellingFromAudioVocabExercise).audio_url ??
      (exercise as ListenMatchVocabExercise | SpellingFromAudioVocabExercise).audioUrl ??
      null
    );
  }

  return null;
}

export function getExerciseAudioStatus(exercise: VocabExerciseBase<VocabExerciseType>) {
  if ("audio_status" in exercise || "audioStatus" in exercise) {
    return (
      (exercise as ListenMatchVocabExercise | SpellingFromAudioVocabExercise).audio_status ??
      (exercise as ListenMatchVocabExercise | SpellingFromAudioVocabExercise).audioStatus ??
      null
    );
  }

  return null;
}
