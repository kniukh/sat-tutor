import Link from "next/link";
import WeeklyLeaderboardTimer from "@/components/student/WeeklyLeaderboardTimer";
import { createClient } from "@/lib/supabase/server";
import {
  studentDashboardPath,
  studentMistakeBrainPath,
  studentVocabularyDrillPath,
} from "@/lib/routes/student";
import { getStudentGamificationSnapshot } from "@/services/gamification/gamification.service";
import { getWeeklyLeaderboardForStudent } from "@/services/gamification/leaderboards.service";

function formatXp(value: number | null | undefined) {
  return `${Math.max(0, Number(value ?? 0))} XP`;
}

function getGapLabel(currentXp: number, targetXp: number) {
  const gap = Math.max(0, targetXp - currentXp);
  if (gap === 0) {
    return "You are tied with the next spot.";
  }

  return `${gap} XP to pass the next learner.`;
}

export default async function StudentProgressPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();

  const { data: student, error } = await supabase
    .from("students")
    .select("id, full_name, access_code")
    .eq("access_code", code)
    .eq("is_active", true)
    .single();

  if (error || !student) {
    throw new Error("Student not found");
  }

  const [gamification, leaderboard] = await Promise.all([
    getStudentGamificationSnapshot(student.id),
    getWeeklyLeaderboardForStudent(student.id),
  ]);

  const currentUser = leaderboard.user;
  const nextCompetitor = leaderboard.nearbyCompetitors
    .filter((entry) => !entry.isCurrentUser && (currentUser?.rank ?? Number.MAX_SAFE_INTEGER) > entry.rank)
    .sort((left, right) => right.rank - left.rank)[0] ?? null;

  return (
    <div className="content-shell max-w-5xl space-y-5">
      <section className="app-hero-panel p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="app-kicker text-white/70">Progress / Competition</div>
            <h1 className="text-[1.95rem] font-semibold leading-[1.02] tracking-[-0.03em] text-white sm:text-[2.5rem]">
              Climb your weekly group.
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-white/72">
              Track your XP, hold your streak, and close the gap to the next spot.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 sm:items-end">
            <WeeklyLeaderboardTimer weekStartDate={leaderboard.weekStartDate} />
            <Link
              href={studentMistakeBrainPath()}
              className="text-sm font-semibold text-white/80 underline underline-offset-4"
            >
              View Insights
            </Link>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[1.35rem] bg-white/10 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
              Total XP
            </div>
            <div className="mt-2 text-3xl font-semibold text-white">
              {Number(gamification.total_xp ?? gamification.xp ?? 0)}
            </div>
          </div>

          <div className="rounded-[1.35rem] bg-white/10 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
              Weekly XP
            </div>
            <div className="mt-2 text-3xl font-semibold text-white">
              {Number(gamification.weekly_xp ?? 0)}
            </div>
          </div>

          <div className="rounded-[1.35rem] bg-white/10 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
              Streak
            </div>
            <div className="mt-2 text-3xl font-semibold text-white">
              {Number(gamification.streak_days ?? 0)}
            </div>
          </div>

          <div className="rounded-[1.35rem] bg-white/10 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
              Rank
            </div>
            <div className="mt-2 text-3xl font-semibold text-white">
              {currentUser ? `#${currentUser.rank}` : "Unranked"}
            </div>
          </div>
        </div>
      </section>

      <section className="card-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="app-kicker">Your Position</div>
            <h2 className="app-heading-md mt-1">
              {leaderboard.groupLabel}
            </h2>
            <p className="app-copy mt-2">
              {leaderboard.memberCount} learners this week. Stay close to the next rank instead of treating the week like a long list.
            </p>
          </div>

          <div className="app-card-soft min-w-[12rem] p-4">
            <div className="app-kicker text-slate-500">Level</div>
            <div className="mt-2 text-3xl font-semibold text-slate-950">
              {Number(gamification.level ?? 1)}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="app-card-soft p-4">
            <div className="app-kicker text-slate-500">Current Position</div>
            <div className="mt-2 text-3xl font-semibold text-slate-950">
              {currentUser ? `#${currentUser.rank}` : "Not ranked"}
            </div>
            <div className="mt-2 text-sm text-slate-600">
              {currentUser ? formatXp(currentUser.weeklyXp) : "Start earning weekly XP to enter the group race."}
            </div>
          </div>

          <div className="app-card-soft p-4">
            <div className="app-kicker text-slate-500">Next Target</div>
            <div className="mt-2 text-xl font-semibold text-slate-950">
              {nextCompetitor ? nextCompetitor.fullName : "You are at the top of your nearby pack"}
            </div>
            <div className="mt-2 text-sm text-slate-600">
              {nextCompetitor && currentUser
                ? getGapLabel(currentUser.weeklyXp, nextCompetitor.weeklyXp + 1)
                : "Keep going to protect your current position and widen the gap."}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="card-surface p-5 sm:p-6">
          <div className="app-kicker">Top 3</div>
          <h2 className="app-heading-md mt-1">Weekly leaders</h2>

          <div className="mt-5 space-y-3">
            {leaderboard.topUsers.map((entry, index) => (
              <div
                key={entry.studentId}
                className={`rounded-[1.4rem] border p-4 ${
                  entry.isCurrentUser
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-slate-50 text-slate-950"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div
                      className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                        entry.isCurrentUser ? "text-white/60" : "text-slate-500"
                      }`}
                    >
                      #{index + 1}
                    </div>
                    <div className="mt-1 text-lg font-semibold">
                      {entry.fullName}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-semibold">
                      {entry.weeklyXp}
                    </div>
                    <div className={entry.isCurrentUser ? "text-sm text-white/70" : "text-sm text-slate-500"}>
                      weekly XP
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card-surface p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="app-kicker">Nearby Competitors</div>
              <h2 className="app-heading-md mt-1">The race around you</h2>
            </div>

            <Link
              href={studentMistakeBrainPath()}
              className="text-sm font-semibold text-slate-600 underline underline-offset-4"
            >
              Need help?
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {leaderboard.nearbyCompetitors.map((entry) => (
              <div
                key={entry.studentId}
                className={`rounded-[1.25rem] border px-4 py-3 ${
                  entry.isCurrentUser
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-950"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div
                      className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                        entry.isCurrentUser ? "text-white/60" : "text-slate-500"
                      }`}
                    >
                      Rank #{entry.rank}
                    </div>
                    <div className="truncate text-base font-semibold">
                      {entry.isCurrentUser ? "You" : entry.fullName}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-base font-semibold">{entry.weeklyXp}</div>
                    <div className={entry.isCurrentUser ? "text-xs text-white/70" : "text-xs text-slate-500"}>
                      weekly XP
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link
              href={studentVocabularyDrillPath({
                mode: "mixed_practice",
                phase: "endless_continuation",
              })}
              className="primary-button flex-1"
            >
              Keep Earning XP
            </Link>
            <Link
              href={studentDashboardPath()}
              className="secondary-button flex-1 sm:flex-none"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
