import Link from "next/link";
import type { StudentVocabularyAnalytics } from "@/services/analytics/vocabulary-analytics.service";
import type { StudentWeeklyLeaderboard } from "@/services/gamification/leaderboards.service";

type CurrentBook = {
  id: string;
  progress_percent: number;
  completed_lessons_count: number;
  total_lessons_count: number;
  current_lesson_id?: string | null;
  current_stage?: string | null;
  source_documents?: {
    id: string;
    title: string;
    author?: string | null;
  } | null;
};

type Props = {
  currentBooks: CurrentBook[];
  readyVocabularyCount: number;
  gamification?: {
    xp?: number;
    level?: number;
    streak_days?: number;
  } | null;
  leaderboard?: StudentWeeklyLeaderboard | null;
  vocabularyAnalytics?: StudentVocabularyAnalytics | null;
  accessCode: string;
};

function formatStageLabel(stage?: string | null) {
  if (!stage) {
    return null;
  }

  return stage.replace(/_/g, " ");
}

export default function StudentDashboardOverview({
  currentBooks,
  readyVocabularyCount,
  gamification,
  leaderboard,
  vocabularyAnalytics,
  accessCode,
}: Props) {
  const featuredBook = currentBooks[0] ?? null;
  const rankLabel = leaderboard?.user?.rank ? `#${leaderboard.user.rank}` : "Not ranked yet";
  const primaryPracticeLabel =
    readyVocabularyCount > 0 ? "Continue Practice" : "Start Practice";
  const readingProgress = Math.round(Number(featuredBook?.progress_percent) || 0);
  const currentStageLabel = formatStageLabel(featuredBook?.current_stage);

  return (
    <div className="space-y-5">
      <section className="app-hero-panel overflow-hidden p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="app-kicker text-white/70">Progress / Competition</div>
            <h2 className="text-[1.8rem] font-semibold leading-[1.05] tracking-[-0.03em] text-white sm:text-[2.2rem]">
              Keep climbing.
            </h2>
          </div>

          <div className="flex flex-col items-end gap-2 text-right">
            <Link
              href={`/s/${accessCode}/progress`}
              className="text-sm font-semibold text-white/80 underline underline-offset-4"
            >
              View Leaderboard
            </Link>
            <Link
              href={`/s/${accessCode}/mistake-brain`}
              className="text-sm font-semibold text-white/70 underline underline-offset-4"
            >
              View Insights
            </Link>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[1.35rem] bg-white/10 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
              XP
            </div>
            <div className="mt-2 text-3xl font-semibold text-white">
              {gamification?.xp ?? 0}
            </div>
          </div>

          <div className="rounded-[1.35rem] bg-white/10 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
              Streak
            </div>
            <div className="mt-2 text-3xl font-semibold text-white">
              {gamification?.streak_days ?? 0}
            </div>
          </div>

          <div className="rounded-[1.35rem] bg-white/10 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
              Level
            </div>
            <div className="mt-2 text-3xl font-semibold text-white">
              {gamification?.level ?? 1}
            </div>
          </div>

          <div className="rounded-[1.35rem] bg-white/10 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
              Leaderboard
            </div>
            <div className="mt-2 text-3xl font-semibold text-white">{rankLabel}</div>
          </div>
        </div>
      </section>

      <section className="card-surface p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="app-kicker">Current Reading</div>
            <h2 className="app-heading-md mt-1">
              {featuredBook?.source_documents?.title ?? "No reading in progress yet"}
            </h2>
            {featuredBook?.source_documents?.author ? (
              <p className="app-copy mt-1">{featuredBook.source_documents.author}</p>
            ) : null}
          </div>
        </div>

        {featuredBook ? (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="app-card-soft p-4">
                <div className="app-kicker text-slate-500">Progress</div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">
                  {readingProgress}%
                </div>
              </div>

              <div className="app-card-soft p-4">
                <div className="app-kicker text-slate-500">Current Stage</div>
                <div className="mt-2 text-2xl font-semibold capitalize text-slate-950">
                  {currentStageLabel ?? "In progress"}
                </div>
              </div>

              <div className="app-card-soft p-4">
                <div className="app-kicker text-slate-500">Lessons</div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">
                  {featuredBook.completed_lessons_count}/{featuredBook.total_lessons_count}
                </div>
              </div>
            </div>

            <div className="mt-4 progress-track">
              <div className="progress-fill" style={{ width: `${readingProgress}%` }} />
            </div>

            {featuredBook.current_lesson_id ? (
              <div className="mt-5">
                <Link
                  href={`/s/${accessCode}/lesson/${featuredBook.current_lesson_id}`}
                  className="primary-button w-full sm:w-auto"
                >
                  Continue Reading
                </Link>
              </div>
            ) : null}
          </>
        ) : (
          <div className="mt-5">
            <Link href={`/s/${accessCode}/book`} className="secondary-button w-full sm:w-auto">
              Open Library
            </Link>
          </div>
        )}
      </section>

      <section className="card-surface p-5 sm:p-6">
        <div>
          <div className="app-kicker">Vocabulary Studio</div>
          <h2 className="app-heading-md mt-1">Practice anytime</h2>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="app-card-soft p-4">
            <div className="app-kicker text-slate-500">Captured</div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">
              {vocabularyAnalytics?.summary.capturedWordsCount ?? 0}
            </div>
          </div>

          <div className="app-card-soft p-4">
            <div className="app-kicker text-slate-500">Mastered</div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">
              {vocabularyAnalytics?.summary.masteredWordsCount ?? 0}
            </div>
          </div>

          <div className="app-card-soft p-4">
            <div className="app-kicker text-slate-500">Practiced today</div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">
              {vocabularyAnalytics?.summary.practicedTodayWordsCount ?? 0}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/s/${accessCode}/vocabulary/drill?mode=mixed_practice`}
            className="primary-button flex-1"
          >
            {primaryPracticeLabel}
          </Link>
          <Link
            href={`/s/${accessCode}/vocabulary/drill?mode=review_weak_words&phase=endless_continuation`}
            className="secondary-button flex-1 sm:flex-none"
          >
            Review Weak Words
          </Link>
        </div>

        <div className="mt-3">
          <Link
            href={`/s/${accessCode}/mistake-brain`}
            className="text-sm font-semibold text-slate-600 underline underline-offset-4"
          >
            View Insights
          </Link>
        </div>
      </section>
    </div>
  );
}
