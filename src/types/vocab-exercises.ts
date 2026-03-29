import type { VocabModality, WordLifecycleState } from "@/types/vocab-tracking";

export type SupportedVocabExerciseType =
  | "meaning_match"
  | "translation_match"
  | "listen_match"
  | "spelling_from_audio"
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
};

export type VocabExerciseQueueBucket =
  | "recently_failed"
  | "weak_again"
  | "overdue"
  | "reinforcement"
  | "scheduled";

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
  acceptable_answers?: string[];
  targetWord?: string;
  targetWordId?: string;
  questionText?: string;
  sentenceText?: string | null;
  correctAnswer?: string;
  acceptableAnswers?: string[];
  difficulty?: number;
  tags?: string[];
  skill?: string;
  reviewMeta?: VocabExerciseReviewMeta;
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
};

export type TranslationMatchVocabExercise = VocabExerciseBase<"translation_match"> & {
  sourceLanguageLabel?: string;
  targetLanguageLabel?: string;
};

export type FillBlankVocabExercise = VocabExerciseBase<"fill_blank"> & {
  clue?: string;
};

export type ContextMeaningVocabExercise = VocabExerciseBase<"context_meaning"> & {
  focusText: string;
  contextText: string;
};

export type SynonymVocabExercise = VocabExerciseBase<"synonym"> & {
  promptStyle?: "closest_meaning" | "best_synonym";
};

export type CollocationVocabExercise = VocabExerciseBase<"collocation"> & {
  stem: string;
  exampleSentence?: string;
};

// Future placeholders keep the contract ready without forcing implementation details yet.
export type ListenMatchVocabExercise = VocabExerciseBase<"listen_match"> &
  AudioBackedExerciseFields;

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
  | ListenMatchVocabExercise
  | SpellingFromAudioVocabExercise
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

export function getExerciseAcceptableAnswers(exercise: VocabExerciseBase<VocabExerciseType>) {
  return exercise.acceptable_answers ?? exercise.acceptableAnswers ?? [];
}

export function getExerciseModality(exercise: VocabExerciseBase<VocabExerciseType>) {
  return exercise.modality ?? "text";
}

export function getExerciseDifficultyBand(exercise: VocabExerciseBase<VocabExerciseType>) {
  return exercise.difficulty_band ?? null;
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
