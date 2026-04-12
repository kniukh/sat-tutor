export async function markVocabularyWordAlreadyKnown(params: {
  studentId: string;
  wordId: string | null;
  word: string;
  lessonId?: string | null;
  sessionId?: string | null;
  sessionMode?: string | null;
}) {
  const response = await fetch("/api/vocabulary/already-know", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error ?? "Failed to mark word as already known");
  }

  return (payload?.data ?? null) as
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
}
