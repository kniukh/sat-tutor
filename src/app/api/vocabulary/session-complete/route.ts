import { NextResponse } from "next/server";
import { isStudentApiAuthError, requireStudentApiStudentId } from "@/lib/auth/student-api";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { awardVocabularySessionCompletionXp } from "@/services/gamification/xp-awards.service";
import { completeGuidedVocabularyCheckpoint } from "@/services/reading/guided-learning.service";
import type { VocabularySessionRow } from "@/types/vocab-tracking";

export async function POST(request: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }
    const studentId = typeof body.studentId === "string" ? body.studentId : "";
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    const sessionMode =
      typeof body.sessionMode === "string"
        ? (body.sessionMode as VocabularySessionRow["mode"])
        : null;
    const completedCount =
      typeof body.completedCount === "number" ? body.completedCount : undefined;
    const readingAssignmentId =
      typeof body.readingAssignmentId === "string" ? body.readingAssignmentId : null;

    if (!sessionId || !sessionMode) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const sessionStudentId = await requireStudentApiStudentId(studentId);

    const supabase = await createServerSupabaseClient();
    const { data: existingSession, error: sessionError } = await supabase
      .from("vocab_sessions")
      .select("*")
      .eq("student_id", sessionStudentId)
      .eq("session_id", sessionId)
      .maybeSingle<VocabularySessionRow>();

    if (sessionError) {
      throw sessionError;
    }

    if (!existingSession) {
      return NextResponse.json({ error: "Vocabulary session not found" }, { status: 404 });
    }

    const { data: attempts, error: attemptsError } = await supabase
      .from("exercise_attempts")
      .select("id, is_correct")
      .eq("student_id", sessionStudentId)
      .eq("session_id", sessionId);
    if (attemptsError) throw attemptsError;

    const safeCompletedCount = attempts?.length ?? 0;
    const expectedCompletedCount = Math.max(0, Math.round(Number(completedCount) || 0));
    if (expectedCompletedCount > 0 && safeCompletedCount < expectedCompletedCount) {
      return NextResponse.json(
        {
          error: "Some exercise attempts are still being saved. Retry checkpoint finalization.",
          savedCount: safeCompletedCount,
          expectedCount: expectedCompletedCount,
        },
        { status: 409 }
      );
    }
    const safeCorrectCount = (attempts ?? []).filter((attempt) => attempt.is_correct).length;
    const safeAccuracy =
      safeCompletedCount > 0
        ? Math.round((safeCorrectCount / safeCompletedCount) * 100)
        : 0;
    const resolvedSession = existingSession;

    const existingMetadata =
      resolvedSession.metadata && typeof resolvedSession.metadata === "object"
        ? (resolvedSession.metadata as Record<string, unknown>)
        : {};

    if (existingMetadata.reward_credited_at) {
      if (readingAssignmentId && !existingMetadata.guided_assignment_checkpoint_recorded) {
        await completeGuidedVocabularyCheckpoint({
          studentId: sessionStudentId,
          assignmentId: readingAssignmentId,
        });
        await supabase
          .from("vocab_sessions")
          .update({
            metadata: {
              ...existingMetadata,
              guided_assignment_checkpoint_recorded: true,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("session_id", sessionId)
          .eq("student_id", sessionStudentId);
      }
      return NextResponse.json({
        ok: true,
        data: {
          xp: existingMetadata.xp_breakdown ?? null,
          gamification: {
            xp: Number(existingMetadata.rewarded_total_xp ?? 0),
            level: Number(existingMetadata.rewarded_level ?? 1),
            streakDays: Number(existingMetadata.rewarded_streak_days ?? 0),
            longestStreakDays: Number(
              existingMetadata.rewarded_longest_streak_days ??
                existingMetadata.rewarded_streak_days ??
              0
            ),
          },
          progress: {
            previousLevel: Number(existingMetadata.rewarded_previous_level ?? existingMetadata.rewarded_level ?? 1),
            currentLevel: Number(existingMetadata.rewarded_level ?? 1),
            leveledUp: Boolean(existingMetadata.rewarded_leveled_up ?? false),
            previousStreakDays: Number(
              existingMetadata.rewarded_previous_streak_days ?? existingMetadata.rewarded_streak_days ?? 0
            ),
            currentStreakDays: Number(existingMetadata.rewarded_streak_days ?? 0),
          },
        },
      });
    }

    const xpReward = await awardVocabularySessionCompletionXp({
      studentId: sessionStudentId,
      session: resolvedSession,
      accuracy: safeAccuracy,
      completedCount: safeCompletedCount,
    });
    const finalizedXpBreakdown = xpReward.breakdown;
    const gamification = xpReward.gamification;

    const completionTimestamp = new Date().toISOString();
    const updatedMetadata = {
      ...existingMetadata,
      reward_credited_at: completionTimestamp,
      xp_breakdown: finalizedXpBreakdown,
      rewarded_total_xp: Number(gamification?.xp ?? 0),
      rewarded_level: Number(gamification?.level ?? 1),
      rewarded_previous_level: Number(xpReward.progress?.previousLevel ?? gamification?.level ?? 1),
      rewarded_leveled_up: Boolean(xpReward.progress?.leveledUp),
      rewarded_streak_days: Number(gamification?.streak_days ?? 0),
      rewarded_previous_streak_days: Number(
        xpReward.progress?.previousStreakDays ?? gamification?.streak_days ?? 0
      ),
      rewarded_longest_streak_days: Number(
        (gamification as Record<string, unknown> | null)?.longest_streak_days ??
          gamification?.streak_days ??
          0
      ),
      finalized_completed_count: safeCompletedCount,
      finalized_correct_count: safeCorrectCount,
      finalized_accuracy: safeAccuracy,
    };

    const { error: updateError } = await supabase
      .from("vocab_sessions")
      .update({
        completed_at: resolvedSession.completed_at ?? completionTimestamp,
        metadata: updatedMetadata,
        updated_at: completionTimestamp,
      })
      .eq("session_id", sessionId)
      .eq("student_id", sessionStudentId);

    if (updateError) {
      throw updateError;
    }

    if (readingAssignmentId) {
      await completeGuidedVocabularyCheckpoint({
        studentId: sessionStudentId,
        assignmentId: readingAssignmentId,
      });
      await supabase
        .from("vocab_sessions")
        .update({
          metadata: {
            ...updatedMetadata,
            guided_assignment_checkpoint_recorded: true,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("session_id", sessionId)
        .eq("student_id", sessionStudentId);
    }

    return NextResponse.json({
      ok: true,
      data: {
        xp: finalizedXpBreakdown,
        xpAwarded: xpReward.xpAwarded,
        gamification: {
          xp: Number(gamification?.xp ?? 0),
          level: Number(gamification?.level ?? 1),
          streakDays: Number(gamification?.streak_days ?? 0),
          longestStreakDays: Number(
            (gamification as Record<string, unknown> | null)?.longest_streak_days ??
              gamification?.streak_days ??
              0
          ),
        },
        progress: xpReward.progress,
      },
    });
  } catch (error: any) {
    if (isStudentApiAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("POST /api/vocabulary/session-complete error", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to finalize vocabulary session" },
      { status: 500 }
    );
  }
}
