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
      }
    | null;
  progressError: string | null;
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
  } satisfies PersistExerciseAttemptResponse;
}
