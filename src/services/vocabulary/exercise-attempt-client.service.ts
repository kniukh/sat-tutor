import type { ExerciseResult } from "@/components/student/exercise-player/types";
import type { SupportedVocabExercise } from "@/types/vocab-exercises";
import type { ExerciseAttemptRow } from "@/types/vocab-tracking";

export type PersistExerciseAttemptResponse = {
  attempt: ExerciseAttemptRow | null;
  progress:
    | {
        progressRow:
          | {
              id: string;
              word_id: string | null;
              lifecycle_state: string;
              mastery_score: number;
              next_review_at: string | null;
            }
          | null;
        reviewQueueRow: unknown | null;
        sameSessionCreditCapped?: boolean;
        session?: {
          session_id: string;
          sequence_index: number;
          exercise_count: number;
          correct_count: number;
        } | null;
      }
    | null;
  progressError: string | null;
  xpReward:
    | {
        xpAwarded?: number;
        breakdown?: {
          baseXp?: number;
          actionLabel?: string;
          comboCountAfter?: number;
          comboMultiplier?: number;
          totalXp?: number;
        } | null;
        progress?: {
          previousLevel?: number;
          currentLevel?: number;
          leveledUp?: boolean;
          previousStreakDays?: number;
          currentStreakDays?: number;
        } | null;
        gamification?: {
          xp?: number;
          level?: number;
          streak_days?: number;
          longest_streak_days?: number;
        } | null;
      }
    | null;
};

export async function persistExerciseAttempt(params: {
  studentId: string;
  result: ExerciseResult;
  exercise: SupportedVocabExercise;
}) {
  const response = await fetch("/api/vocabulary/exercise-attempt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error ?? "Failed to persist exercise attempt");
  }

  return {
    attempt: (payload?.data ?? null) as ExerciseAttemptRow | null,
    progress: payload?.progress ?? null,
    progressError: payload?.progressError ?? null,
    xpReward: payload?.xpReward ?? null,
  } satisfies PersistExerciseAttemptResponse;
}
