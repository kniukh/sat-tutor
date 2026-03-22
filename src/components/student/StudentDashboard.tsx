import Link from 'next/link';

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

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">
          Welcome, {studentName}
        </h1>
        <p className="mt-2 text-slate-600">Student dashboard</p>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-slate-500">Lessons completed</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {lessonsCompleted}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-slate-500">Average accuracy</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {Math.round(averageAccuracy * 100)}%
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-slate-500">Words due</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {dueWordsCount}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-slate-500">Book progress</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {currentBook ? `${Math.round(Number(currentBook.progress_percent))}%` : '0%'}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-slate-500">Streak</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {gamification.streak_days}🔥
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-slate-500">XP</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {gamification.xp}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-slate-500">Level</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {gamification.level}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-slate-500">Achievements</div>
          <div className="mt-2 text-base font-semibold text-slate-900">
            {gamification.achievements?.length > 0
              ? gamification.achievements.join(', ')
              : 'No achievements yet'}
          </div>
        </div>
      </div>

      {currentBook ? (
        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-slate-500">Resume reading</div>
          <div className="mt-2 font-semibold text-slate-900">
            {currentBook.source_documents?.title ?? 'Current book'}
          </div>
          <div className="mt-1 text-sm text-slate-600">
            {currentBook.completed_lessons_count} / {currentBook.total_lessons_count} parts completed
          </div>

          {currentBook.current_lesson_id ? (
            <div className="mt-4">
              <Link
                href={`/s/${studentCode}/lesson/${currentBook.current_lesson_id}`}
                className="rounded-xl bg-slate-900 px-5 py-3 text-white"
              >
                Resume
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-slate-500">Continue learning</div>
          {nextLesson ? (
            <div className="mt-3 space-y-3">
              <div className="font-semibold text-slate-900">{nextLesson.name}</div>
              <div className="text-sm text-slate-600">{nextLesson.lesson_type}</div>
              <Link
                href={`/s/${studentCode}/lesson/${nextLesson.id}`}
                className="inline-block rounded-xl bg-slate-900 px-5 py-3 text-white"
              >
                Open next lesson
              </Link>
            </div>
          ) : (
            <div className="mt-3 text-slate-600">No next lesson available.</div>
          )}
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-slate-500">Current focus</div>
          <div className="mt-3 font-semibold text-slate-900">
            {primaryFocusArea ?? 'No major weak area yet'}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={`/s/${studentCode}/book`}
              className="rounded-xl bg-slate-900 px-5 py-3 text-white"
            >
              Open Book
            </Link>

            <Link
              href={`/s/${studentCode}/progress`}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-slate-900"
            >
              Open Progress
            </Link>

            <Link
              href={`/s/${studentCode}/vocabulary`}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-slate-900"
            >
              Open Vocabulary
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}