import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureWeeklyLeaderboardMembership } from "@/services/gamification/leaderboards.service";
import type { XpEventType } from "@/services/gamification/xp-policy.service";

export type StudentGamificationRow = {
  id: string;
  student_id: string;
  xp: number | null;
  total_xp?: number | null;
  weekly_xp?: number | null;
  weekly_xp_started_at?: string | null;
  level: number | null;
  streak_days: number | null;
  longest_streak_days?: number | null;
  last_activity_date?: string | null;
  achievements?: string[] | null;
  updated_at?: string | null;
};

type XpEventRow = {
  id: string;
  student_id: string;
  event_key: string | null;
  event_type: XpEventType;
  xp_awarded: number;
  total_xp_after: number | null;
  weekly_xp_after: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function calculateLevel(totalXp: number) {
  return Math.floor(totalXp / 100) + 1;
}

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function getWeekStartDateOnly(value: Date) {
  const start = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  const day = start.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setUTCDate(start.getUTCDate() + diff);
  return start.toISOString().slice(0, 10);
}

function diffDays(a: string, b: string) {
  const aDate = new Date(`${a}T00:00:00`);
  const bDate = new Date(`${b}T00:00:00`);
  const diffMs = bDate.getTime() - aDate.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function normalizeAchievements(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function pickBestGamificationRow(rows: StudentGamificationRow[]) {
  return [...rows].sort((left, right) => {
    const leftUpdatedAt = left.updated_at ? Date.parse(left.updated_at) : 0;
    const rightUpdatedAt = right.updated_at ? Date.parse(right.updated_at) : 0;

    if (rightUpdatedAt !== leftUpdatedAt) {
      return rightUpdatedAt - leftUpdatedAt;
    }

    const leftTotalXp = Number(left.total_xp ?? left.xp ?? 0);
    const rightTotalXp = Number(right.total_xp ?? right.xp ?? 0);

    if (rightTotalXp !== leftTotalXp) {
      return rightTotalXp - leftTotalXp;
    }

    return String(right.id ?? "").localeCompare(String(left.id ?? ""));
  })[0];
}

function toNormalizedGamificationRow(
  row: StudentGamificationRow,
  now: Date = new Date()
) {
  const totalXp = Number(row.total_xp ?? row.xp ?? 0);
  const currentWeekStart = getWeekStartDateOnly(now);
  const weeklyXpStartedAt = row.weekly_xp_started_at ?? currentWeekStart;
  const weeklyXp =
    weeklyXpStartedAt === currentWeekStart ? Number(row.weekly_xp ?? 0) : 0;
  const streakDays = Number(row.streak_days ?? 0);
  const longestStreakDays = Math.max(
    streakDays,
    Number(row.longest_streak_days ?? streakDays)
  );

  return {
    ...row,
    xp: totalXp,
    total_xp: totalXp,
    weekly_xp: weeklyXp,
    weekly_xp_started_at: weeklyXpStartedAt,
    level: Number(row.level ?? calculateLevel(totalXp)),
    streak_days: streakDays,
    longest_streak_days: longestStreakDays,
    achievements: normalizeAchievements(row.achievements),
  } satisfies StudentGamificationRow;
}

async function normalizeStoredGamificationRow(params: {
  row: StudentGamificationRow;
  now?: Date;
}) {
  const supabase = await createServerSupabaseClient();
  const now = params.now ?? new Date();
  const normalized = toNormalizedGamificationRow(params.row, now);
  const incomingAchievements = normalizeAchievements(params.row.achievements);
  const rowNeedsUpdate =
    Number(params.row.xp ?? 0) !== normalized.total_xp ||
    Number(params.row.total_xp ?? 0) !== normalized.total_xp ||
    Number(params.row.weekly_xp ?? 0) !== normalized.weekly_xp ||
    (params.row.weekly_xp_started_at ?? null) !== normalized.weekly_xp_started_at ||
    Number(params.row.level ?? 0) !== normalized.level ||
    Number(params.row.longest_streak_days ?? 0) !== normalized.longest_streak_days ||
    incomingAchievements.length !== normalizeAchievements(normalized.achievements).length;

  if (!rowNeedsUpdate) {
    return normalized;
  }

  const { data, error } = await supabase
    .from("student_gamification")
    .update({
      xp: normalized.total_xp,
      total_xp: normalized.total_xp,
      weekly_xp: normalized.weekly_xp,
      weekly_xp_started_at: normalized.weekly_xp_started_at,
      level: normalized.level,
      longest_streak_days: normalized.longest_streak_days,
      achievements: normalized.achievements,
      updated_at: now.toISOString(),
    })
    .eq("id", normalized.id)
    .select("*")
    .single<StudentGamificationRow>();

  if (error) {
    throw error;
  }

  return toNormalizedGamificationRow(data, now);
}

export async function getOrCreateStudentGamification(studentId: string) {
  const supabase = await createServerSupabaseClient();

  const { data: existingRows, error: existingError } = await supabase
    .from("student_gamification")
    .select("*")
    .eq("student_id", studentId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .returns<StudentGamificationRow[]>();

  if (existingError) {
    throw existingError;
  }

  if ((existingRows ?? []).length > 0) {
    if ((existingRows ?? []).length > 1) {
      console.error("Duplicate student_gamification rows detected", {
        studentId,
        rowIds: existingRows?.map((row) => row.id) ?? [],
      });
    }

    return normalizeStoredGamificationRow({ row: pickBestGamificationRow(existingRows ?? []) });
  }

  const now = new Date();
  const weekStart = getWeekStartDateOnly(now);

  const { data: created, error: createError } = await supabase
    .from("student_gamification")
    .insert({
      student_id: studentId,
      xp: 0,
      total_xp: 0,
      weekly_xp: 0,
      weekly_xp_started_at: weekStart,
      level: 1,
      streak_days: 0,
      longest_streak_days: 0,
      achievements: [],
    })
    .select("*")
    .single<StudentGamificationRow>();

  if (createError) {
    if (createError.code === "23505") {
      const { data: racedRows, error: racedError } = await supabase
        .from("student_gamification")
        .select("*")
        .eq("student_id", studentId)
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("id", { ascending: false })
        .limit(1)
        .returns<StudentGamificationRow[]>();

      if (racedError) {
        throw racedError;
      }

      if ((racedRows ?? []).length > 0) {
        return normalizeStoredGamificationRow({ row: racedRows![0] });
      }
    }

    throw createError;
  }

  return toNormalizedGamificationRow(created, now);
}

export async function getStudentGamificationSnapshot(studentId: string) {
  return getOrCreateStudentGamification(studentId);
}

export async function getXpEventByKey(eventKey: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("xp_events")
    .select("*")
    .eq("event_key", eventKey)
    .maybeSingle<XpEventRow>();

  if (error) {
    throw error;
  }

  return data;
}

export async function awardStudentXpEvent(params: {
  studentId: string;
  xpToAdd: number;
  eventType: XpEventType;
  eventKey?: string | null;
  questionAttemptId?: string | null;
  exerciseAttemptId?: string | null;
  lessonAttemptId?: string | null;
  vocabSessionId?: string | null;
  lessonId?: string | null;
  targetWordId?: string | null;
  targetWord?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = await createServerSupabaseClient();
  const normalizedXpToAdd = Math.max(0, Math.round(params.xpToAdd));

  if (normalizedXpToAdd > 0) {
    try {
      await ensureWeeklyLeaderboardMembership(params.studentId);
    } catch (error) {
      console.error("Weekly leaderboard membership sync failed", error);
    }
  }

  if (params.eventKey) {
    const existingEvent = await getXpEventByKey(params.eventKey);
    if (existingEvent) {
      const gamification = await getOrCreateStudentGamification(params.studentId);
      return {
        gamification,
        xpAwarded: Number(existingEvent.xp_awarded ?? 0),
        event: existingEvent,
        deduplicated: true,
        progress: {
          previousLevel: Number(gamification.level ?? 1),
          currentLevel: Number(gamification.level ?? 1),
          leveledUp: false,
          previousStreakDays: Number(gamification.streak_days ?? 0),
          currentStreakDays: Number(gamification.streak_days ?? 0),
        },
      };
    }
  }

  const current = await getOrCreateStudentGamification(params.studentId);
  const now = new Date();
  const today = toDateOnly(now);
  const weekStart = getWeekStartDateOnly(now);
  const lastDate = current.last_activity_date as string | null;

  let streakDays = Number(current.streak_days ?? 0);

  if (!lastDate) {
    streakDays = normalizedXpToAdd > 0 ? 1 : 0;
  } else {
    const days = diffDays(lastDate, today);

    if (days === 0) {
      streakDays = Number(current.streak_days ?? 0);
    } else if (days === 1 && normalizedXpToAdd > 0) {
      streakDays = Number(current.streak_days ?? 0) + 1;
    } else if (normalizedXpToAdd > 0) {
      streakDays = 1;
    }
  }

  const totalXp = Number(current.total_xp ?? current.xp ?? 0) + normalizedXpToAdd;
  const weeklyXp =
    (current.weekly_xp_started_at === weekStart ? Number(current.weekly_xp ?? 0) : 0) +
    normalizedXpToAdd;
  const level = calculateLevel(totalXp);
  const achievements = normalizeAchievements(current.achievements);
  const longestStreakDays = Math.max(
    Number(current.longest_streak_days ?? current.streak_days ?? 0),
    streakDays
  );

  if (streakDays >= 3 && !achievements.includes("3_day_streak")) {
    achievements.push("3_day_streak");
  }

  if (totalXp >= 100 && !achievements.includes("100_xp")) {
    achievements.push("100_xp");
  }

  if (totalXp >= 300 && !achievements.includes("300_xp")) {
    achievements.push("300_xp");
  }

  const { data: updatedGamification, error: updateError } = await supabase
    .from("student_gamification")
    .update({
      xp: totalXp,
      total_xp: totalXp,
      weekly_xp: weeklyXp,
      weekly_xp_started_at: weekStart,
      level,
      streak_days: streakDays,
      longest_streak_days: longestStreakDays,
      last_activity_date: normalizedXpToAdd > 0 ? today : current.last_activity_date,
      achievements,
      updated_at: now.toISOString(),
    })
    .eq("id", current.id)
    .select("*")
    .single<StudentGamificationRow>();

  if (updateError) {
    throw updateError;
  }

  let createdEvent: XpEventRow | null = null;

  const { data: eventData, error: eventError } = await supabase
    .from("xp_events")
    .insert({
      student_id: params.studentId,
      event_key: params.eventKey ?? null,
      event_type: params.eventType,
      question_attempt_id: params.questionAttemptId ?? null,
      exercise_attempt_id: params.exerciseAttemptId ?? null,
      lesson_attempt_id: params.lessonAttemptId ?? null,
      vocab_session_id: params.vocabSessionId ?? null,
      lesson_id: params.lessonId ?? null,
      target_word_id: params.targetWordId ?? null,
      target_word: params.targetWord ?? null,
      xp_awarded: normalizedXpToAdd,
      total_xp_after: totalXp,
      weekly_xp_after: weeklyXp,
      metadata: params.metadata ?? {},
      created_at: now.toISOString(),
    })
    .select("*")
    .maybeSingle<XpEventRow>();

  if (eventError) {
    if (params.eventKey) {
      const existingEvent = await getXpEventByKey(params.eventKey);
      if (existingEvent) {
        createdEvent = existingEvent;
      } else {
        throw eventError;
      }
    } else {
      throw eventError;
    }
  } else {
    createdEvent = eventData;
  }

  return {
    gamification: toNormalizedGamificationRow(updatedGamification, now),
    xpAwarded: normalizedXpToAdd,
    event: createdEvent,
    deduplicated: false,
    progress: {
      previousLevel: Number(current.level ?? calculateLevel(Number(current.total_xp ?? current.xp ?? 0))),
      currentLevel: level,
      leveledUp: level > Number(current.level ?? calculateLevel(Number(current.total_xp ?? current.xp ?? 0))),
      previousStreakDays: Number(current.streak_days ?? 0),
      currentStreakDays: streakDays,
    },
  };
}

export async function awardStudentActivity(params: {
  studentId: string;
  xpToAdd: number;
  eventType?: XpEventType;
  eventKey?: string | null;
  lessonId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return (
    await awardStudentXpEvent({
      studentId: params.studentId,
      xpToAdd: params.xpToAdd,
      eventType: params.eventType ?? "generic_activity",
      eventKey: params.eventKey ?? null,
      lessonId: params.lessonId ?? null,
      metadata: params.metadata ?? {},
    })
  ).gamification;
}
