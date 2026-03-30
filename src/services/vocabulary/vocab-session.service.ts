import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  VocabularySessionMode,
  VocabularySessionRow,
} from "@/types/vocab-tracking";

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
