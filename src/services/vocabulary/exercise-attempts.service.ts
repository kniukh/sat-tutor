import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ExerciseAttemptRow } from "@/types/vocab-tracking";
import type { ExerciseResult } from "@/components/student/exercise-player/types";
import {
  getExerciseAcceptableAnswers,
  getExerciseCorrectAnswer,
  getExerciseCorrectSequence,
  getExerciseDifficultyBand,
  getExerciseModality,
  getExercisePairLeftId,
  getExercisePairRightId,
  getExercisePairs,
  type SupportedVocabExercise,
} from "@/types/vocab-exercises";

function sorted(values: string[]) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function resolveSnapshotExercise(
  exercises: SupportedVocabExercise[],
  result: ExerciseResult
) {
  const metadata = result.metadata ?? {};
  const candidates = [
    result.exercise_id,
    typeof metadata.retry_followup_exercise_id === "string"
      ? metadata.retry_followup_exercise_id
      : null,
    typeof metadata.retry_source_exercise_id === "string"
      ? metadata.retry_source_exercise_id
      : null,
    result.exercise_id.split(":retry")[0],
  ].filter((value): value is string => Boolean(value));

  return exercises.find((exercise) => candidates.includes(exercise.id)) ?? null;
}

function verifyResult(
  exercise: SupportedVocabExercise,
  result: ExerciseResult
) {
  const metadata = result.metadata ?? {};

  if (
    exercise.type === "pair_match" ||
    (exercise.type === "listen_match" && getExercisePairs(exercise).length > 1)
  ) {
    const selected = Array.isArray(metadata.selected_pairs)
      ? metadata.selected_pairs.map(String)
      : [];
    const expected = getExercisePairs(exercise).map(
      (pair) => `${getExercisePairLeftId(pair)}::${getExercisePairRightId(pair)}`
    );
    return JSON.stringify(sorted(selected)) === JSON.stringify(sorted(expected));
  }

  if (exercise.type === "sentence_builder") {
    const selected = Array.isArray(metadata.selected_tile_ids)
      ? metadata.selected_tile_ids.map(String)
      : [];
    return JSON.stringify(selected) === JSON.stringify(getExerciseCorrectSequence(exercise));
  }

  if (exercise.type === "spelling_from_audio") {
    const selected = String(result.selected_answer ?? result.user_answer ?? "")
      .trim()
      .toLowerCase();
    return getExerciseAcceptableAnswers(exercise)
      .map((answer) => answer.trim().toLowerCase())
      .includes(selected);
  }

  const selectedOptionId =
    typeof metadata.selected_option_id === "string"
      ? metadata.selected_option_id
      : "";
  return getExerciseAcceptableAnswers(exercise).includes(selectedOptionId);
}

export async function verifyVocabularyExerciseAttempt(params: {
  studentId: string;
  result: ExerciseResult;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: session, error } = await supabase
    .from("vocab_sessions")
    .select("metadata, completed_at")
    .eq("student_id", params.studentId)
    .eq("session_id", params.result.session_id)
    .maybeSingle<{
      metadata: Record<string, unknown> | null;
      completed_at: string | null;
    }>();

  if (error) throw error;
  if (session?.completed_at) {
    throw new Error("This vocabulary session is already complete. Start a new drill.");
  }

  const snapshot = session?.metadata?.exercise_snapshot;
  if (!Array.isArray(snapshot)) {
    throw new Error("Vocabulary session snapshot not found. Refresh the drill and try again.");
  }

  const exercise = resolveSnapshotExercise(
    snapshot as SupportedVocabExercise[],
    params.result
  );
  if (!exercise) {
    throw new Error("Exercise does not belong to this vocabulary session");
  }

  return {
    exercise,
    result: {
      ...params.result,
      exercise_type: exercise.type,
      target_word_id:
        exercise.target_word_id ?? exercise.targetWordId ?? params.result.target_word_id,
      target_word:
        exercise.target_word ?? exercise.targetWord ?? params.result.target_word,
      correct_answer: getExerciseCorrectAnswer(exercise),
      is_correct: verifyResult(exercise, params.result),
      response_time_ms: Math.min(
        Math.max(Math.round(Number(params.result.response_time_ms) || 1), 1_000),
        30 * 60 * 1_000
      ),
      created_at: new Date().toISOString(),
    } satisfies ExerciseResult,
  };
}

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
    client_attempt_id: params.result.client_attempt_id,
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

  if (error?.code === "23505") {
    const { data: existing, error: existingError } = await supabase
      .from("exercise_attempts")
      .select("*")
      .eq("student_id", params.studentId)
      .eq("client_attempt_id", params.result.client_attempt_id)
      .single();
    if (existingError) throw existingError;
    return { attempt: existing, deduplicated: true };
  }

  if (error) {
    throw error;
  }

  return { attempt: data, deduplicated: false };
}
