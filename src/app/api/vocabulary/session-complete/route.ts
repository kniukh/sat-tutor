import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { awardVocabularySessionCompletionXp } from "@/services/gamification/xp-awards.service";
import type { VocabularySessionRow } from "@/types/vocab-tracking";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      studentId,
      sessionId,
      sessionMode,
      completedCount,
      correctCount,
      accuracy,
    }: {
      studentId: string;
      sessionId: string;
      sessionMode: VocabularySessionRow["mode"];
      completedCount: number;
      correctCount: number;
      accuracy: number;
    } = body;

    if (!studentId || !sessionId || !sessionMode || !Number.isFinite(completedCount)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: existingSession, error: sessionError } = await supabase
      .from("vocab_sessions")
      .select("*")
      .eq("student_id", studentId)
      .eq("session_id", sessionId)
      .maybeSingle<VocabularySessionRow>();

    if (sessionError) {
      throw sessionError;
    }

    if (!existingSession) {
      return NextResponse.json(
        { error: "Vocabulary session not found" },
        { status: 404 }
      );
    }

    const existingMetadata =
      existingSession.metadata && typeof existingSession.metadata === "object"
        ? (existingSession.metadata as Record<string, unknown>)
        : {};

    if (existingMetadata.reward_credited_at) {
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

    const safeCompletedCount = Math.max(0, Math.round(completedCount));
    const safeCorrectCount = Math.max(0, Math.round(correctCount));
    const safeAccuracy =
      Number.isFinite(accuracy) && accuracy >= 0 ? Math.round(accuracy) : 0;
    const xpReward = await awardVocabularySessionCompletionXp({
      studentId,
      session: existingSession,
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
        completed_at: existingSession.completed_at ?? completionTimestamp,
        metadata: updatedMetadata,
        updated_at: completionTimestamp,
      })
      .eq("session_id", sessionId)
      .eq("student_id", studentId);

    if (updateError) {
      throw updateError;
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
    console.error("POST /api/vocabulary/session-complete error", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to finalize vocabulary session" },
      { status: 500 }
    );
  }
}
