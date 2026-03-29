import type { VocabExerciseSession } from "@/services/vocabulary/session-builder";
import type { VocabularySessionRewardCredit } from "@/services/vocabulary/session-results.service";

export async function finalizeVocabularySession(params: {
  studentId: string;
  sessionId: string;
  sessionMode: VocabExerciseSession["mode"];
  completedCount: number;
  correctCount: number;
  accuracy: number;
}) {
  const response = await fetch("/api/vocabulary/session-complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error ?? "Failed to finalize vocabulary session");
  }

  return (payload?.data ?? null) as VocabularySessionRewardCredit | null;
}
