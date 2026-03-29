import { createServerSupabaseClient } from '@/lib/supabase/server';

function calculateLevel(xp: number) {
  return Math.floor(xp / 100) + 1;
}

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function diffDays(a: string, b: string) {
  const aDate = new Date(`${a}T00:00:00`);
  const bDate = new Date(`${b}T00:00:00`);
  const diffMs = bDate.getTime() - aDate.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export async function getOrCreateStudentGamification(studentId: string) {
  const supabase = await createServerSupabaseClient();

  const { data: existing, error: existingError } = await supabase
    .from('student_gamification')
    .select('*')
    .eq('student_id', studentId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return existing;
  }

  const { data: created, error: createError } = await supabase
    .from('student_gamification')
    .insert({
      student_id: studentId,
      xp: 0,
      level: 1,
      streak_days: 0,
      achievements: [],
    })
    .select()
    .single();

  if (createError) {
    throw createError;
  }

  return created;
}

export async function awardStudentActivity(params: {
  studentId: string;
  xpToAdd: number;
}) {
  const supabase = await createServerSupabaseClient();
  const current = await getOrCreateStudentGamification(params.studentId);

  const today = toDateOnly(new Date());
  const lastDate = current.last_activity_date as string | null;

  let streakDays = Number(current.streak_days ?? 0);

  if (!lastDate) {
    streakDays = 1;
  } else {
    const days = diffDays(lastDate, today);

    if (days === 0) {
      streakDays = Number(current.streak_days ?? 0);
    } else if (days === 1) {
      streakDays = Number(current.streak_days ?? 0) + 1;
    } else {
      streakDays = 1;
    }
  }

  const xp = Number(current.xp ?? 0) + params.xpToAdd;
  const level = calculateLevel(xp);

  const achievements = Array.isArray(current.achievements)
    ? [...current.achievements]
    : [];

  if (streakDays >= 3 && !achievements.includes('3_day_streak')) {
    achievements.push('3_day_streak');
  }

  if (xp >= 100 && !achievements.includes('100_xp')) {
    achievements.push('100_xp');
  }

  if (xp >= 300 && !achievements.includes('300_xp')) {
    achievements.push('300_xp');
  }

  const { data, error } = await supabase
    .from('student_gamification')
    .update({
      xp,
      level,
      streak_days: streakDays,
      last_activity_date: today,
      achievements,
      updated_at: new Date().toISOString(),
    })
    .eq('id', current.id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}
