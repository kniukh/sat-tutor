import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ExerciseAttemptRow } from "@/types/vocab-tracking";
import type { ExerciseResult } from "@/components/student/exercise-player/types";
import {
  getExerciseAcceptableAnswers,
  getExerciseDifficultyBand,
  getExerciseModality,
  type SupportedVocabExercise,
} from "@/types/vocab-exercises";

function inferModality(exercise: SupportedVocabExercise): ExerciseAttemptRow["modality"] {
  if (exercise.modality) {
    return getExerciseModality(exercise);
  }

  if (
    exercise.type === "pair_match" ||
    exercise.type === "context_meaning" ||
    exercise.type === "fill_blank" ||
    exercise.type === "error_detection"
  ) {
    return "context";
  }

  return "text";
}

function inferDifficultyBand(
  exercise: SupportedVocabExercise
): ExerciseAttemptRow["difficulty_band"] {
  const adaptiveBand = exercise.reviewMeta?.adaptiveDifficultyBand ?? null;
  if (adaptiveBand) return adaptiveBand;

  const explicitBand = getExerciseDifficultyBand(exercise);
  if (explicitBand) return explicitBand;

  const difficulty = exercise.difficulty;
  if (typeof difficulty !== "number") return null;

  if (difficulty <= 1.5) return "easy";
  if (difficulty <= 2.5) return "medium";
  return "hard";
}

export async function saveExerciseAttempt(params: {
  studentId: string;
  result: ExerciseResult;
  exercise: SupportedVocabExercise;
}) {
  const supabase = await createServerSupabaseClient();
  const selectedAnswer = params.result.selected_answer ?? params.result.user_answer;

  const row = {
    student_id: params.studentId,
    lesson_id: params.result.lesson_id,
    session_id: params.result.session_id,
    exercise_id: params.result.exercise_id,
    exercise_type: params.result.exercise_type,
    target_word_id: params.result.target_word_id,
    target_word: params.result.target_word,
    modality: inferModality(params.exercise),
    difficulty_band: inferDifficultyBand(params.exercise),
    user_answer: {
      value: selectedAnswer,
    },
    correct_answer: {
      value: params.result.correct_answer,
      acceptable_answers: getExerciseAcceptableAnswers(params.exercise),
    },
    is_correct: params.result.is_correct,
    attempt_count: params.result.attempt_count ?? params.result.attempt_index,
    response_time_ms: params.result.response_time_ms,
    confidence: params.result.confidence,
    metadata: {
      tags: params.exercise.tags ?? [],
      skill: params.exercise.skill ?? null,
      session_mode:
        typeof params.result.metadata?.session_mode === "string"
          ? params.result.metadata.session_mode
          : null,
      review_meta: params.exercise.reviewMeta ?? {},
      attempt_index: params.result.attempt_index,
      word_progress_id: params.result.word_progress_id,
      client_attempt_metadata: params.result.metadata ?? {},
    },
    created_at: params.result.created_at,
  };

  const { data, error } = await supabase
    .from("exercise_attempts")
    .insert(row)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}
