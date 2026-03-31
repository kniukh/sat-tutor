import { createServerSupabaseClient } from "@/lib/supabase/server";

const LEADERBOARD_TARGET_GROUP_SIZE = 15;
const LEADERBOARD_MAX_GROUP_SIZE = 20;

type WeeklyLeaderboardGroupRow = {
  id: string;
  week_start_date: string;
  group_number: number;
  target_size: number;
  member_count: number;
};

type WeeklyLeaderboardMembershipRow = {
  id: string;
  group_id: string;
  student_id: string;
  week_start_date: string;
  joined_at: string;
};

type LeaderboardStudentRow = {
  id: string;
  full_name: string;
};

type LeaderboardGamificationRow = {
  student_id: string;
  xp: number | null;
  total_xp?: number | null;
  weekly_xp?: number | null;
  weekly_xp_started_at?: string | null;
  level?: number | null;
};

export type WeeklyLeaderboardEntry = {
  studentId: string;
  fullName: string;
  weeklyXp: number;
  totalXp: number;
  level: number;
  rank: number;
  isCurrentUser: boolean;
};

export type StudentWeeklyLeaderboard = {
  weekStartDate: string;
  groupId: string;
  groupNumber: number;
  groupLabel: string;
  memberCount: number;
  user: WeeklyLeaderboardEntry | null;
  topUsers: WeeklyLeaderboardEntry[];
  nearbyCompetitors: WeeklyLeaderboardEntry[];
};

function getWeekStartDateOnly(value: Date) {
  const start = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  const day = start.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setUTCDate(start.getUTCDate() + diff);
  return start.toISOString().slice(0, 10);
}

async function syncLeaderboardGroupMemberCount(groupId: string) {
  const supabase = await createServerSupabaseClient();
  const { count, error: countError } = await supabase
    .from("weekly_leaderboard_members")
    .select("*", { count: "exact", head: true })
    .eq("group_id", groupId);

  if (countError) {
    throw countError;
  }

  const memberCount = Number(count ?? 0);
  const { error: updateError } = await supabase
    .from("weekly_leaderboard_groups")
    .update({ member_count: memberCount })
    .eq("id", groupId);

  if (updateError) {
    throw updateError;
  }

  return memberCount;
}

async function createWeeklyLeaderboardGroup(weekStartDate: string) {
  const supabase = await createServerSupabaseClient();
  const { count, error: countError } = await supabase
    .from("weekly_leaderboard_groups")
    .select("*", { count: "exact", head: true })
    .eq("week_start_date", weekStartDate);

  if (countError) {
    throw countError;
  }

  const nextGroupNumber = Number(count ?? 0) + 1;
  const { data, error } = await supabase
    .from("weekly_leaderboard_groups")
    .insert({
      week_start_date: weekStartDate,
      group_number: nextGroupNumber,
      target_size: LEADERBOARD_TARGET_GROUP_SIZE,
      member_count: 0,
    })
    .select("*")
    .single<WeeklyLeaderboardGroupRow>();

  if (error) {
    const { data: fallback, error: fallbackError } = await supabase
      .from("weekly_leaderboard_groups")
      .select("*")
      .eq("week_start_date", weekStartDate)
      .lt("member_count", LEADERBOARD_MAX_GROUP_SIZE)
      .order("member_count", { ascending: true })
      .order("group_number", { ascending: true })
      .limit(1)
      .maybeSingle<WeeklyLeaderboardGroupRow>();

    if (fallbackError) {
      throw fallbackError;
    }

    if (!fallback) {
      throw error;
    }

    return fallback;
  }

  return data;
}

async function pickWeeklyLeaderboardGroup(weekStartDate: string) {
  const supabase = await createServerSupabaseClient();

  const { data: preferredGroup, error: preferredGroupError } = await supabase
    .from("weekly_leaderboard_groups")
    .select("*")
    .eq("week_start_date", weekStartDate)
    .lt("member_count", LEADERBOARD_TARGET_GROUP_SIZE)
    .order("member_count", { ascending: false })
    .order("group_number", { ascending: true })
    .limit(1)
    .maybeSingle<WeeklyLeaderboardGroupRow>();

  if (preferredGroupError) {
    throw preferredGroupError;
  }

  if (preferredGroup) {
    return preferredGroup;
  }

  const { data: fallbackGroup, error: fallbackGroupError } = await supabase
    .from("weekly_leaderboard_groups")
    .select("*")
    .eq("week_start_date", weekStartDate)
    .lt("member_count", LEADERBOARD_MAX_GROUP_SIZE)
    .order("member_count", { ascending: true })
    .order("group_number", { ascending: true })
    .limit(1)
    .maybeSingle<WeeklyLeaderboardGroupRow>();

  if (fallbackGroupError) {
    throw fallbackGroupError;
  }

  if (fallbackGroup) {
    return fallbackGroup;
  }

  return createWeeklyLeaderboardGroup(weekStartDate);
}

export async function ensureWeeklyLeaderboardMembership(studentId: string) {
  const supabase = await createServerSupabaseClient();
  const weekStartDate = getWeekStartDateOnly(new Date());

  const { data: existing, error: existingError } = await supabase
    .from("weekly_leaderboard_members")
    .select("*")
    .eq("student_id", studentId)
    .eq("week_start_date", weekStartDate)
    .maybeSingle<WeeklyLeaderboardMembershipRow>();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return existing;
  }

  const targetGroup = await pickWeeklyLeaderboardGroup(weekStartDate);
  const { data: created, error: createError } = await supabase
    .from("weekly_leaderboard_members")
    .insert({
      group_id: targetGroup.id,
      student_id: studentId,
      week_start_date: weekStartDate,
      joined_at: new Date().toISOString(),
    })
    .select("*")
    .single<WeeklyLeaderboardMembershipRow>();

  if (createError) {
    const { data: fallback, error: fallbackError } = await supabase
      .from("weekly_leaderboard_members")
      .select("*")
      .eq("student_id", studentId)
      .eq("week_start_date", weekStartDate)
      .maybeSingle<WeeklyLeaderboardMembershipRow>();

    if (fallbackError) {
      throw fallbackError;
    }

    if (!fallback) {
      throw createError;
    }

    await syncLeaderboardGroupMemberCount(fallback.group_id);
    return fallback;
  }

  await syncLeaderboardGroupMemberCount(targetGroup.id);
  return created;
}

function buildLeaderboardEntries(params: {
  studentId: string;
  memberships: WeeklyLeaderboardMembershipRow[];
  students: LeaderboardStudentRow[];
  gamificationRows: LeaderboardGamificationRow[];
  weekStartDate: string;
}) {
  const studentMap = new Map(params.students.map((student) => [student.id, student]));
  const gamificationMap = new Map(
    params.gamificationRows.map((row) => [row.student_id, row])
  );

  return params.memberships
    .map((membership) => {
      const student = studentMap.get(membership.student_id);
      const gamification = gamificationMap.get(membership.student_id);
      const weeklyXp =
        gamification?.weekly_xp_started_at === params.weekStartDate
          ? Number(gamification?.weekly_xp ?? 0)
          : 0;
      const totalXp = Number(gamification?.total_xp ?? gamification?.xp ?? 0);
      const level = Number(gamification?.level ?? 1);

      return {
        studentId: membership.student_id,
        fullName: student?.full_name ?? "Student",
        weeklyXp,
        totalXp,
        level,
        joinedAt: membership.joined_at,
        isCurrentUser: membership.student_id === params.studentId,
      };
    })
    .sort((left, right) => {
      if (right.weeklyXp !== left.weeklyXp) {
        return right.weeklyXp - left.weeklyXp;
      }

      if (right.totalXp !== left.totalXp) {
        return right.totalXp - left.totalXp;
      }

      if (left.joinedAt !== right.joinedAt) {
        return left.joinedAt.localeCompare(right.joinedAt);
      }

      return left.fullName.localeCompare(right.fullName);
    })
    .map((entry, index) => ({
      studentId: entry.studentId,
      fullName: entry.fullName,
      weeklyXp: entry.weeklyXp,
      totalXp: entry.totalXp,
      level: entry.level,
      rank: index + 1,
      isCurrentUser: entry.isCurrentUser,
    })) satisfies WeeklyLeaderboardEntry[];
}

export async function getWeeklyLeaderboardForStudent(studentId: string) {
  const supabase = await createServerSupabaseClient();
  const membership = await ensureWeeklyLeaderboardMembership(studentId);

  const [{ data: group, error: groupError }, { data: memberships, error: membershipsError }] =
    await Promise.all([
      supabase
        .from("weekly_leaderboard_groups")
        .select("*")
        .eq("id", membership.group_id)
        .single<WeeklyLeaderboardGroupRow>(),
      supabase
        .from("weekly_leaderboard_members")
        .select("*")
        .eq("group_id", membership.group_id)
        .order("joined_at", { ascending: true })
        .returns<WeeklyLeaderboardMembershipRow[]>(),
    ]);

  if (groupError) {
    throw groupError;
  }

  if (membershipsError) {
    throw membershipsError;
  }

  const memberStudentIds = (memberships ?? []).map((item) => item.student_id);
  const [studentsResult, gamificationResult] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name")
      .in("id", memberStudentIds.length > 0 ? memberStudentIds : ["00000000-0000-0000-0000-000000000000"])
      .returns<LeaderboardStudentRow[]>(),
    supabase
      .from("student_gamification")
      .select("student_id, xp, total_xp, weekly_xp, weekly_xp_started_at, level")
      .in("student_id", memberStudentIds.length > 0 ? memberStudentIds : ["00000000-0000-0000-0000-000000000000"])
      .returns<LeaderboardGamificationRow[]>(),
  ]);

  if (studentsResult.error) {
    throw studentsResult.error;
  }

  if (gamificationResult.error) {
    throw gamificationResult.error;
  }

  const entries = buildLeaderboardEntries({
    studentId,
    memberships: memberships ?? [],
    students: studentsResult.data ?? [],
    gamificationRows: gamificationResult.data ?? [],
    weekStartDate: membership.week_start_date,
  });
  const currentUserIndex = entries.findIndex((entry) => entry.studentId === studentId);
  const nearbyStart = Math.max(0, currentUserIndex - 2);
  const nearbyEnd = Math.min(entries.length, currentUserIndex + 3);

  return {
    weekStartDate: membership.week_start_date,
    groupId: group.id,
    groupNumber: group.group_number,
    groupLabel: `Weekly Group ${group.group_number}`,
    memberCount: Math.max(Number(group.member_count ?? 0), entries.length),
    user: currentUserIndex >= 0 ? entries[currentUserIndex] : null,
    topUsers: entries.slice(0, 3),
    nearbyCompetitors: entries.slice(nearbyStart, nearbyEnd),
  } satisfies StudentWeeklyLeaderboard;
}
