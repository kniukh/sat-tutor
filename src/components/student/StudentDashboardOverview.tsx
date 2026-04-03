import Link from "next/link";
import {
  studentBookLibraryPath,
  studentLessonPath,
  studentMistakeBrainPath,
  studentProgressPath,
  studentVocabularyDrillPath,
} from "@/lib/routes/student";
import type { StudentVocabularyAnalytics } from "@/services/analytics/vocabulary-analytics.service";
import type { StudentWeeklyLeaderboard } from "@/services/gamification/leaderboards.service";
import FeedbackSettingsButton from "./FeedbackSettingsButton";
import StudentLogoutButton from "./StudentLogoutButton";

function LibraryIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
      <path
        d="M4.5 4.75a1.75 1.75 0 011.75-1.75h7.5A1.75 1.75 0 0115.5 4.75v10.5a.75.75 0 01-1.12.65L10 13.4l-4.38 2.5a.75.75 0 01-1.12-.65V4.75z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

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
    metadata?: {
      cover_image_path?: string | null;
    } | null;
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

function getCoverImagePath(book: CurrentBook | null) {
  const metadata = book?.source_documents?.metadata;
  return metadata?.cover_image_path ?? null;
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
  const coverImagePath = getCoverImagePath(featuredBook);

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
              href={studentProgressPath()}
              className="hero-link"
            >
              View Leaderboard
            </Link>
            <Link
              href={studentMistakeBrainPath()}
              className="hero-link"
            >
              View Insights
            </Link>
            <FeedbackSettingsButton tone="dark" />
            <StudentLogoutButton tone="dark" />
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="hero-stat-card">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] token-text-inverse-muted">
              XP
            </div>
            <div className="mt-2 text-3xl font-semibold token-text-inverse">
              {gamification?.xp ?? 0}
            </div>
          </div>

          <div className="hero-stat-card">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] token-text-inverse-muted">
              Streak
            </div>
            <div className="mt-2 text-3xl font-semibold token-text-inverse">
              {gamification?.streak_days ?? 0}
            </div>
          </div>

          <div className="hero-stat-card">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] token-text-inverse-muted">
              Level
            </div>
            <div className="mt-2 text-3xl font-semibold token-text-inverse">
              {gamification?.level ?? 1}
            </div>
          </div>

          <div className="hero-stat-card">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] token-text-inverse-muted">
              Leaderboard
            </div>
            <div className="mt-2 text-3xl font-semibold token-text-inverse">{rankLabel}</div>
          </div>
        </div>
      </section>

      <section className="card-surface p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            {featuredBook ? (
              <div className="surface-soft-panel flex h-24 w-18 shrink-0 items-center justify-center overflow-hidden rounded-[1.25rem]">
                {coverImagePath ? (
                  <img
                    src={coverImagePath}
                    alt={`${featuredBook.source_documents?.title ?? "Book"} cover`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="app-kicker token-text-muted text-center">Cover</div>
                )}
              </div>
            ) : null}

            <div className="min-w-0">
              <div className="app-kicker">Current Reading</div>
              <h2 className="app-heading-md mt-1">
                {featuredBook?.source_documents?.title ?? "No reading in progress yet"}
              </h2>
              {featuredBook?.source_documents?.author ? (
                <p className="app-copy mt-1">{featuredBook.source_documents.author}</p>
              ) : null}
            </div>
          </div>
        </div>

        {featuredBook ? (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="app-card-soft p-4">
                <div className="app-kicker token-text-muted">Progress</div>
                <div className="mt-2 text-2xl font-semibold token-text-primary">
                  {readingProgress}%
                </div>
              </div>

              <div className="app-card-soft p-4">
                <div className="app-kicker token-text-muted">Current Stage</div>
                <div className="mt-2 text-2xl font-semibold capitalize token-text-primary">
                  {currentStageLabel ?? "In progress"}
                </div>
              </div>

              <div className="app-card-soft p-4">
                <div className="app-kicker token-text-muted">Lessons</div>
                <div className="mt-2 text-2xl font-semibold token-text-primary">
                  {featuredBook.completed_lessons_count}/{featuredBook.total_lessons_count}
                </div>
              </div>
            </div>

            <div className="mt-4 progress-track">
              <div className="progress-fill" style={{ width: `${readingProgress}%` }} />
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              {featuredBook.current_lesson_id ? (
                <Link
                  href={studentLessonPath(featuredBook.current_lesson_id)}
                  className="primary-button w-full sm:w-auto"
                >
                  Continue Reading
                </Link>
              ) : null}
              <Link href={studentBookLibraryPath()} className="secondary-button inline-flex w-full items-center justify-center gap-2 sm:w-auto">
                <LibraryIcon />
                <span>Go to Library</span>
              </Link>
            </div>
          </>
        ) : (
          <div className="mt-5">
            <Link href={studentBookLibraryPath()} className="secondary-button inline-flex w-full items-center justify-center gap-2 sm:w-auto">
              <LibraryIcon />
              <span>Go to Library</span>
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
            <div className="app-kicker token-text-muted">Captured</div>
            <div className="mt-2 text-2xl font-semibold token-text-primary">
              {vocabularyAnalytics?.summary.capturedWordsCount ?? 0}
            </div>
          </div>

          <div className="app-card-soft p-4">
            <div className="app-kicker token-text-muted">Mastered</div>
            <div className="mt-2 text-2xl font-semibold token-text-primary">
              {vocabularyAnalytics?.summary.masteredWordsCount ?? 0}
            </div>
          </div>

          <div className="app-card-soft p-4">
            <div className="app-kicker token-text-muted">Practiced today</div>
            <div className="mt-2 text-2xl font-semibold token-text-primary">
              {vocabularyAnalytics?.summary.practicedTodayWordsCount ?? 0}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Link
            href={studentVocabularyDrillPath({ mode: "mixed_practice" })}
            className="primary-button flex-1"
          >
            {primaryPracticeLabel}
          </Link>
          <Link
            href={studentVocabularyDrillPath({
              mode: "review_weak_words",
              phase: "endless_continuation",
            })}
            className="secondary-button flex-1 sm:flex-none"
          >
            Review Weak Words
          </Link>
        </div>

        <div className="mt-3">
          <Link
            href={studentMistakeBrainPath()}
            className="text-sm font-semibold token-text-secondary underline underline-offset-4"
          >
            View Insights
          </Link>
        </div>
      </section>
    </div>
  );
}
