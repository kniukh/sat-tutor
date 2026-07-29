import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  SupportedVocabExercise,
} from "@/types/vocab-exercises";
import type {
  VocabularySessionMode,
  VocabularySessionRow,
} from "@/types/vocab-tracking";

export async function registerVocabularySessionSnapshot(params: {
  studentId: string;
  sessionId: string;
  sessionMode: VocabularySessionMode;
  exercises: SupportedVocabExercise[];
  metadata?: Record<string, unknown>;
}) {
  const supabase = await createServerSupabaseClient();
  const now = new Date().toISOString();
  const { data: existing, error: existingError } = await supabase
    .from("vocab_sessions")
    .select("*")
    .eq("session_id", params.sessionId)
    .eq("student_id", params.studentId)
    .maybeSingle<VocabularySessionRow>();

  if (existingError) throw existingError;

  const snapshotMetadata = {
    ...(existing?.metadata ?? {}),
    ...(params.metadata ?? {}),
    exercise_snapshot: params.exercises,
    expected_exercise_count: params.exercises.length,
    snapshot_registered_at: now,
  };

  if (existing) {
    if (existing.completed_at) {
      throw new Error(
        "A completed vocabulary session cannot be reused. Start a new drill."
      );
    }

    const { error } = await supabase
      .from("vocab_sessions")
      .update({
        mode: params.sessionMode,
        metadata: snapshotMetadata,
        updated_at: now,
      })
      .eq("session_id", params.sessionId)
      .eq("student_id", params.studentId);
    if (error) throw error;
    return;
  }

  const currentIndex = await getCurrentVocabularySessionIndex(params.studentId);
  const { error } = await supabase.from("vocab_sessions").insert({
    session_id: params.sessionId,
    student_id: params.studentId,
    mode: params.sessionMode,
    sequence_index: currentIndex + 1,
    started_at: now,
    last_activity_at: now,
    exercise_count: 0,
    correct_count: 0,
    metadata: snapshotMetadata,
  });
  if (error && error.code !== "23505") throw error;
}

export async function getCurrentVocabularySessionIndex(studentId: string) {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("vocab_sessions")
    .select("sequence_index")
    .eq("student_id", studentId)
    .order("sequence_index", { ascending: false })
    .limit(1)
    .maybeSingle<{ sequence_index: number }>();

  if (error) {
    throw error;
  }

  return data?.sequence_index ?? 0;
}

export async function ensureVocabularySessionForAttempt(params: {
  studentId: string;
  sessionId: string;
  sessionMode?: VocabularySessionMode | null;
  sessionMetadata?: Record<string, unknown> | null;
  attemptCreatedAt: string;
  isCorrect: boolean;
}) {
  const supabase = await createServerSupabaseClient();

  const { data: existing, error: existingError } = await supabase
    .from("vocab_sessions")
    .select("*")
    .eq("session_id", params.sessionId)
    .eq("student_id", params.studentId)
    .maybeSingle<VocabularySessionRow>();

  if (existingError) {
    throw existingError;
  }

  const incomingSessionMetadata =
    params.sessionMetadata && typeof params.sessionMetadata === "object"
      ? params.sessionMetadata
      : {};

  if (existing) {
    if (existing.completed_at) {
      throw new Error(
        "This vocabulary session is already complete. Start a new drill."
      );
    }

    const { data, error } = await supabase
      .from("vocab_sessions")
      .update({
        mode: existing.mode ?? params.sessionMode ?? null,
        last_activity_at: params.attemptCreatedAt,
        exercise_count: Number(existing.exercise_count ?? 0) + 1,
        correct_count: Number(existing.correct_count ?? 0) + (params.isCorrect ? 1 : 0),
        metadata: {
          ...(existing.metadata ?? {}),
          ...incomingSessionMetadata,
          latest_attempt_at: params.attemptCreatedAt,
        },
      })
      .eq("session_id", params.sessionId)
      .select("*")
      .single<VocabularySessionRow>();

    if (error) {
      throw error;
    }

    return data;
  }

  const currentIndex = await getCurrentVocabularySessionIndex(params.studentId);
  const nextIndex = currentIndex + 1;

  const { data, error } = await supabase
    .from("vocab_sessions")
    .insert({
      session_id: params.sessionId,
      student_id: params.studentId,
      mode: params.sessionMode ?? null,
      sequence_index: nextIndex,
      started_at: params.attemptCreatedAt,
      last_activity_at: params.attemptCreatedAt,
      exercise_count: 1,
      correct_count: params.isCorrect ? 1 : 0,
      metadata: {
        ...incomingSessionMetadata,
        latest_attempt_at: params.attemptCreatedAt,
      },
    })
    .select("*")
    .single<VocabularySessionRow>();

  if (error) {
    throw error;
  }

  return data;
}
