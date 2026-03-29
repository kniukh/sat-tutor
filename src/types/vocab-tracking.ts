export type VocabExerciseType =
  | "meaning_match"
  | "translation_match"
  | "fill_blank"
  | "context_meaning"
  | "synonym"
  | "collocation"
  | "listen_match"
  | "spelling_from_audio"
  | "spelling"
  | "memory"
  | "speed_round";

export type VocabModality = "text" | "context" | "audio" | "memory" | "mixed";

export type VocabDifficultyBand = "easy" | "medium" | "hard";

export type WordProgressStatus = "learning" | "review" | "mastered";

export type WordLifecycleState = "new" | "learning" | "review" | "mastered" | "weak_again";

export type ReviewQueueStatus =
  | "pending"
  | "scheduled"
  | "completed"
  | "skipped"
  | "cancelled";

export type ExerciseAttemptRow = {
  id: string;
  student_id: string;
  lesson_id: string | null;
  session_id: string;
  exercise_id: string;
  exercise_type: VocabExerciseType;
  target_word_id: string | null;
  target_word: string | null;
  modality: VocabModality | null;
  difficulty_band: VocabDifficultyBand | null;
  user_answer: Record<string, unknown> | unknown[];
  correct_answer: Record<string, unknown> | unknown[];
  is_correct: boolean;
  attempt_count: number;
  response_time_ms: number;
  confidence: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type WordProgressRow = {
  id: string;
  student_id: string;
  word: string;
  word_id: string | null;
  status: WordProgressStatus;
  lifecycle_state: WordLifecycleState;
  current_difficulty_band: VocabDifficultyBand | null;
  mastery_score: number;
  total_attempts: number;
  correct_attempts: number;
  times_seen: number;
  times_correct: number;
  times_wrong: number;
  last_seen_at: string | null;
  next_review_date: string | null;
  next_review_at: string | null;
  consecutive_correct: number;
  consecutive_incorrect: number;
  last_modality: VocabModality | null;
  source_lesson_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ReviewQueueRow = {
  id: string;
  student_id: string;
  word_id: string;
  priority_score: number;
  scheduled_for: string;
  reason: string;
  recommended_modality: VocabModality | null;
  source_attempt_id: string | null;
  status: ReviewQueueStatus;
  created_at: string;
  updated_at: string;
};
