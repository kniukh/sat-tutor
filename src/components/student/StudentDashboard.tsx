import Link from "next/link";
import {
  studentBookDetailPath,
  studentBookLibraryPath,
  studentLessonPath,
  studentProgressPath,
  studentVocabularyPath,
} from "@/lib/routes/student";

export function StudentDashboard({
  studentName,
  lessonsCompleted,
  averageAccuracy,
  studentCode,
  nextLesson,
  dueWordsCount,
  primaryFocusArea,
  bookProgress,
  gamification,
}: {
  studentName: string;
  lessonsCompleted: number;
  averageAccuracy: number;
  studentCode: string;
  nextLesson: {
    id: string;
    name: string;
    lesson_type: string;
  } | null;
  dueWordsCount: number;
  primaryFocusArea: string | null;
  bookProgress: any[];
  gamification: {
    xp: number;
    level: number;
    streak_days: number;
    achievements: string[];
  };
}) {
  const currentBook = bookProgress?.[0] ?? null;
  const bookProgressPercent = currentBook
    ? Math.round(Number(currentBook.progress_percent) || 0)
    : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">
          Welcome, {studentName}
        </h1>
        <p className="mt-2 text-slate-600">
          Your reading dashboard, with books, streaks, and the next best lesson.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border bg-white p-5">
          <div className="text-sm text-slate-500">Lessons completed</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {lessonsCompleted}
          </div>
        </div>

        <div className="rounded-3xl border bg-white p-5">
          <div className="text-sm text-slate-500">Average accuracy</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {Math.round(averageAccuracy * 100)}%
          </div>
        </div>

        <div className="rounded-3xl border bg-white p-5">
          <div className="text-sm text-slate-500">Words due</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {dueWordsCount}
          </div>
        </div>

        <div className="rounded-3xl border bg-white p-5">
          <div className="text-sm text-slate-500">Streak</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {gamification.streak_days}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <div className="grid gap-6 p-6 md:grid-cols-[1.15fr_0.85fr] md:p-8">
            <div className="space-y-4">
              <div className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">
                Current Reading
              </div>

              <div>
                <h2 className="text-3xl font-semibold text-slate-900">
                  {currentBook?.source_documents?.title ?? "No active book yet"}
                </h2>
                <p className="mt-2 text-slate-600">
                  {currentBook?.source_documents?.author ?? "Pick a book from your library to start a chapter-based reading path."}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">Book progress</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">
                    {bookProgressPercent}%
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">Completed</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">
                    {currentBook?.completed_lessons_count ?? 0}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">Total lessons</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">
                    {currentBook?.total_lessons_count ?? 0}
                  </div>
                </div>
              </div>

              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-slate-900"
                  style={{ width: `${bookProgressPercent}%` }}
                />
              </div>

              <div className="flex flex-wrap gap-3">
                {currentBook?.current_lesson_id ? (
                  <Link
                    href={studentLessonPath(currentBook.current_lesson_id)}
                    className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
                  >
                    Continue Reading
                  </Link>
                ) : null}

                <Link
                  href={studentBookLibraryPath()}
                  className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900"
                >
                  Open Library
                </Link>

                {currentBook?.source_documents?.id ? (
                  <Link
                    href={studentBookDetailPath(currentBook.source_documents.id)}
                    className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900"
                  >
                    Open Book
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="rounded-[2rem] bg-slate-900 p-6 text-white">
              <div className="text-sm uppercase tracking-[0.18em] text-slate-300">
                Momentum
              </div>
              <div className="mt-4 text-2xl font-semibold">
                Level {gamification.level}
              </div>
              <div className="mt-2 text-sm text-slate-300">
                {gamification.xp} XP earned
              </div>
              <div className="mt-6 rounded-2xl bg-white/10 p-4 text-sm text-slate-200">
                {gamification.achievements?.length > 0
                  ? gamification.achievements.join(", ")
                  : "Keep going to unlock your first achievement."}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border bg-white p-6">
          <div className="text-xl font-semibold text-slate-900">Continue learning</div>

          {nextLesson ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Next lesson</div>
                <div className="mt-2 text-xl font-semibold text-slate-900">
                  {nextLesson.name}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {nextLesson.lesson_type}
                </div>
              </div>

              <Link
                href={studentLessonPath(nextLesson.id)}
                className="inline-flex rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
              >
                Open next lesson
              </Link>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-slate-600">
              No next lesson available.
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-slate-200 p-4">
            <div className="text-sm text-slate-500">Current focus</div>
            <div className="mt-2 font-semibold text-slate-900">
              {primaryFocusArea ?? "No major weak area yet"}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={studentProgressPath()}
              className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900"
            >
              Open Progress
            </Link>

            <Link
              href={studentVocabularyPath()}
              className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900"
            >
              Open Vocabulary
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
