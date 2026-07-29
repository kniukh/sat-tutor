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

type CurrentBook = {
  id: string;
  progress_percent: number;
  completed_lessons_count: number;
  total_lessons_count: number;
  current_lesson_id?: string | null;
  source_documents?: {
    id: string;
    title: string;
    author?: string | null;
    metadata?: { cover_image_path?: string | null } | null;
  } | null;
};

type Props = {
  currentBooks: CurrentBook[];
  readyVocabularyCount: number;
  gamification?: { xp?: number; level?: number; streak_days?: number } | null;
  leaderboard?: StudentWeeklyLeaderboard | null;
  vocabularyAnalytics?: StudentVocabularyAnalytics | null;
  accessCode: string;
};

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path d="M4 5.5c3.2-1.1 5.9-.5 8 1.7v12c-2.1-2.2-4.8-2.8-8-1.7v-12Zm16 0c-3.2-1.1-5.9-.5-8 1.7v12c2.1-2.2 4.8-2.8 8-1.7v-12Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
    </svg>
  );
}

export default function StudentDashboardOverview({
  currentBooks,
  readyVocabularyCount,
  gamification,
  vocabularyAnalytics,
  accessCode,
}: Props) {
  const book = currentBooks[0] ?? null;
  const progress = Math.round(Number(book?.progress_percent) || 0);
  const cover = book?.source_documents?.metadata?.cover_image_path ?? null;
  const captured = vocabularyAnalytics?.summary.capturedWordsCount ?? 0;
  const mastered = vocabularyAnalytics?.summary.masteredWordsCount ?? 0;

  return (
    <div className="coach-dashboard">
      <section className="coach-stats" aria-label="Your progress">
        <Link href={studentProgressPath()} className="coach-stat coach-stat--xp">
          <span>XP</span><strong>{gamification?.xp ?? 0}</strong>
        </Link>
        <Link href={studentProgressPath()} className="coach-stat coach-stat--streak">
          <span>🔥 Streak</span><strong>{gamification?.streak_days ?? 0} days</strong>
        </Link>
        <Link href={studentProgressPath()} className="coach-stat coach-stat--level">
          <span>Level</span><strong>{gamification?.level ?? 1}</strong>
        </Link>
      </section>

      <section className="coach-current-card">
        <div className="coach-current-cover">
          {cover ? (
            <img src={cover} alt={`${book?.source_documents?.title ?? "Current book"} cover`} />
          ) : (
            <div className="coach-cover-fallback"><BookIcon /></div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="coach-eyebrow"><BookIcon /> Current reading</div>
          <h2>{book?.source_documents?.title ?? "Choose your first book"}</h2>
          <p>{book?.source_documents?.author ?? "Your next reading journey starts here."}</p>
          {book ? (
            <>
              <div className="mt-5 flex items-center justify-between gap-3 text-sm font-semibold">
                <span>{progress}% complete</span>
                <span className="text-slate-500">{book.completed_lessons_count}/{book.total_lessons_count} lessons</span>
              </div>
              <div className="coach-progress mt-2"><span style={{ width: `${progress}%` }} /></div>
            </>
          ) : null}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            {book?.current_lesson_id ? (
              <Link href={studentLessonPath(book.current_lesson_id, accessCode)} className="coach-primary-button">
                <BookIcon /> Continue reading <span aria-hidden="true">›</span>
              </Link>
            ) : null}
            <Link href={studentBookLibraryPath()} className="coach-secondary-button">Go to library</Link>
          </div>
        </div>
      </section>

      <div className="coach-feature-grid">
        <section className="coach-feature-card coach-feature-card--vocab">
          <div className="coach-feature-icon">Aa</div>
          <div>
            <div className="coach-eyebrow">Vocabulary</div>
            <h2>Build your word power</h2>
            <p>{captured} saved · {mastered} mastered · {readyVocabularyCount} ready</p>
          </div>
          <Link href={studentVocabularyDrillPath({ mode: "mixed_practice" })} className="coach-primary-button coach-primary-button--blue">
            {readyVocabularyCount > 0 ? "Continue practice" : "Start practice"} <span>›</span>
          </Link>
        </section>

        <section className="coach-feature-card coach-feature-card--review">
          <div className="coach-feature-icon">✓</div>
          <div>
            <div className="coach-eyebrow">Mistake review</div>
            <h2>Turn misses into progress</h2>
            <p>Revisit difficult questions and strengthen weak skills.</p>
          </div>
          <Link href={studentMistakeBrainPath()} className="coach-secondary-button">Review mistakes</Link>
        </section>
      </div>
    </div>
  );
}
