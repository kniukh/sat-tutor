import { NextResponse } from "next/server";
import { isStudentApiAuthError, requireStudentApiStudentId } from "@/lib/auth/student-api";
import {
  saveExerciseAttempt,
  verifyVocabularyExerciseAttempt,
} from "@/services/vocabulary/exercise-attempts.service";
import { applyExerciseAttemptToProgress } from "@/services/vocabulary/exercise-progress.service";
import { awardVocabularyExerciseXp } from "@/services/gamification/xp-awards.service";
import type { ExerciseResult } from "@/components/student/exercise-player/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      studentId,
      result,
    }: {
      studentId: string;
      result: ExerciseResult;
    } = body;

    if (!result?.client_attempt_id || !result?.exercise_id || !result?.session_id) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const sessionStudentId = await requireStudentApiStudentId(studentId);
    const verified = await verifyVocabularyExerciseAttempt({
      studentId: sessionStudentId,
      result,
    });

    const savedResult = await saveExerciseAttempt({
      studentId: sessionStudentId,
      result: verified.result,
      exercise: verified.exercise,
    });
    const saved = savedResult.attempt;

    if (savedResult.deduplicated) {
      return NextResponse.json({
        ok: true,
        data: saved,
        deduplicated: true,
        progress: null,
        progressError: null,
        xpReward: null,
      });
    }

    let progress = null;
    let progressError: string | null = null;
    let xpReward = null;

    try {
      progress = await applyExerciseAttemptToProgress({
        studentId: sessionStudentId,
        attempt: saved,
      });
    } catch (error: any) {
      progressError = error?.message ?? "Failed to update word progress";
      console.error("Word progress update failed after saving exercise attempt", error);
    }

    try {
      xpReward = await awardVocabularyExerciseXp({
        studentId: sessionStudentId,
        attempt: saved,
        exercise: verified.exercise,
        sameSessionCreditCapped: Boolean((progress as any)?.sameSessionCreditCapped),
        resultingLifecycleState: (progress as any)?.progressRow?.lifecycle_state ?? null,
      });
    } catch (error) {
      console.error("Vocabulary XP reward failed after saving exercise attempt", error);
    }

    return NextResponse.json({ ok: true, data: saved, progress, progressError, xpReward });
  } catch (error: any) {
    if (isStudentApiAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (
      error instanceof Error &&
      (error.message.includes("session snapshot") ||
        error.message.includes("does not belong"))
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof Error && error.message.includes("already complete")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error("POST /api/vocabulary/exercise-attempt error", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to save exercise attempt" },
      { status: 500 }
    );
  }
}
