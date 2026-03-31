import { NextResponse } from "next/server";
import { saveExerciseAttempt } from "@/services/vocabulary/exercise-attempts.service";
import { applyExerciseAttemptToProgress } from "@/services/vocabulary/exercise-progress.service";
import { awardVocabularyExerciseXp } from "@/services/gamification/xp-awards.service";
import type { ExerciseResult } from "@/components/student/exercise-player/types";
import type { SupportedVocabExercise } from "@/types/vocab-exercises";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      studentId,
      result,
      exercise,
    }: {
      studentId: string;
      result: ExerciseResult;
      exercise: SupportedVocabExercise;
    } = body;

    if (
      !studentId ||
      !result?.exercise_id ||
      !result?.session_id ||
      !exercise?.id ||
      exercise.id !== result.exercise_id
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const saved = await saveExerciseAttempt({
      studentId,
      result,
      exercise,
    });

    let progress = null;
    let progressError: string | null = null;
    let xpReward = null;

    try {
      progress = await applyExerciseAttemptToProgress({
        studentId,
        attempt: saved,
      });
    } catch (error: any) {
      progressError = error?.message ?? "Failed to update word progress";
      console.error("Word progress update failed after saving exercise attempt", error);
    }

    try {
      xpReward = await awardVocabularyExerciseXp({
        studentId,
        attempt: saved,
        exercise,
        sameSessionCreditCapped: Boolean((progress as any)?.sameSessionCreditCapped),
        resultingLifecycleState: (progress as any)?.progressRow?.lifecycle_state ?? null,
      });
    } catch (error) {
      console.error("Vocabulary XP reward failed after saving exercise attempt", error);
    }

    return NextResponse.json({ ok: true, data: saved, progress, progressError, xpReward });
  } catch (error: any) {
    console.error("POST /api/vocabulary/exercise-attempt error", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to save exercise attempt" },
      { status: 500 }
    );
  }
}
