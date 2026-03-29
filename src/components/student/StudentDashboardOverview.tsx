import Link from "next/link";

type SkillItem = {
  id: string;
  skill: string;
  attempts_count: number;
  correct_count: number;
  accuracy: number;
};

type DueWord = {
  id: string;
  word: string;
  status: string;
  next_review_date: string;
};

type RecentLesson = {
  id: string;
  score: number;
  total_questions: number;
  accuracy: number;
  completed_at: string;
  lessons?: {
    id: string;
    name: string;
    lesson_type: string;
  } | null;
};

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
  } | null;
};

type Props = {
  weakestSkills: SkillItem[];
  dueVocabulary: DueWord[];
  recentLessons: RecentLesson[];
  currentBooks: CurrentBook[];
  gamification?: {
    xp?: number;
    level?: number;
    streak_days?: number;
  } | null;
  accessCode: string;
};

export default function StudentDashboardOverview({
  weakestSkills,
  dueVocabulary,
  recentLessons,
  currentBooks,
  gamification,
  accessCode,
}: Props) {
  const featuredBook = currentBooks[0] ?? null;
  const secondaryBooks = currentBooks.slice(1);

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-slate-500">XP</div>
          <div className="text-3xl font-semibold">{gamification?.xp ?? 0}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-slate-500">Level</div>
          <div className="text-3xl font-semibold">{gamification?.level ?? 1}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-slate-500">Streak</div>
          <div className="text-3xl font-semibold">{gamification?.streak_days ?? 0}</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border bg-white p-5 space-y-4">
          <div className="text-xl font-semibold">Weakest Skills</div>

          {weakestSkills.length === 0 ? (
            <div className="text-slate-500">No skill data yet.</div>
          ) : (
            <div className="space-y-3">
              {weakestSkills.map((skill) => (
                <div
                  key={skill.id}
                  className="flex items-center justify-between border rounded-xl px-4 py-3"
                >
                  <div className="font-medium">{skill.skill}</div>
                  <div className="text-slate-600">
                    {Math.round((Number(skill.accuracy) || 0) * 100)}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-white p-5 space-y-4">
          <div className="text-xl font-semibold">Due Vocabulary</div>

          {dueVocabulary.length === 0 ? (
            <div className="text-slate-500">No words due today.</div>
          ) : (
            <div className="space-y-3">
              {dueVocabulary.slice(0, 8).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between border rounded-xl px-4 py-3"
                >
                  <div className="font-medium">{item.word}</div>
                  <div className="text-slate-600">{item.status}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border bg-white p-5 space-y-4">
          <div className="text-xl font-semibold">Recent Lessons</div>

          {recentLessons.length === 0 ? (
            <div className="text-slate-500">No completed lessons yet.</div>
          ) : (
            <div className="space-y-3">
              {recentLessons.map((item) => (
                <div
                  key={item.id}
                  className="border rounded-xl px-4 py-3 space-y-1"
                >
                  <div className="font-medium">{item.lessons?.name ?? "Lesson"}</div>
                  <div className="text-sm text-slate-600">
                    Score: {item.score}/{item.total_questions} · Accuracy:{" "}
                    {Math.round((Number(item.accuracy) || 0) * 100)}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-white p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xl font-semibold">Current Reading</div>
            <Link
              href={`/s/${accessCode}/book`}
              className="text-sm font-medium text-slate-600 underline"
            >
              Open Library
            </Link>
          </div>

          {featuredBook ? (
            <div className="space-y-4">
              <div className="rounded-[1.75rem] bg-slate-900 p-5 text-white">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                  Continue Reading
                </div>

                <div className="mt-3 text-2xl font-semibold">
                  {featuredBook.source_documents?.title ?? "Current book"}
                </div>

                <div className="mt-2 text-sm text-slate-300">
                  {featuredBook.source_documents?.author ?? "Unknown author"}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white/10 p-3">
                    <div className="text-xs uppercase tracking-[0.14em] text-slate-300">
                      Progress
                    </div>
                    <div className="mt-2 text-xl font-semibold">
                      {Math.round(Number(featuredBook.progress_percent) || 0)}%
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white/10 p-3">
                    <div className="text-xs uppercase tracking-[0.14em] text-slate-300">
                      Completed
                    </div>
                    <div className="mt-2 text-xl font-semibold">
                      {featuredBook.completed_lessons_count}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white/10 p-3">
                    <div className="text-xs uppercase tracking-[0.14em] text-slate-300">
                      Total
                    </div>
                    <div className="mt-2 text-xl font-semibold">
                      {featuredBook.total_lessons_count}
                    </div>
                  </div>
                </div>

                <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-white"
                    style={{
                      width: `${Math.round(Number(featuredBook.progress_percent) || 0)}%`,
                    }}
                  />
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  {featuredBook.current_lesson_id ? (
                    <Link
                      href={`/s/${accessCode}/lesson/${featuredBook.current_lesson_id}`}
                      className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-900"
                    >
                      Continue Reading
                    </Link>
                  ) : null}

                  {featuredBook.source_documents?.id ? (
                    <Link
                      href={`/s/${accessCode}/book/${featuredBook.source_documents.id}`}
                      className="rounded-2xl border border-white/20 px-4 py-2 text-sm font-semibold text-white"
                    >
                      Open Book
                    </Link>
                  ) : null}
                </div>
              </div>

              {secondaryBooks.length > 0 ? (
                <div className="space-y-3">
                  {secondaryBooks.map((book) => (
                    <div
                      key={book.id}
                      className="rounded-2xl border border-slate-200 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-medium text-slate-900">
                            {book.source_documents?.title ?? "Book"}
                          </div>
                          <div className="mt-1 text-sm text-slate-600">
                            {book.source_documents?.author ?? "Unknown author"}
                          </div>
                        </div>

                        <div className="rounded-xl bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700">
                          {Math.round(Number(book.progress_percent) || 0)}%
                        </div>
                      </div>

                      <div className="mt-3 text-sm text-slate-600">
                        {book.completed_lessons_count} / {book.total_lessons_count} lessons completed
                      </div>

                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-slate-900"
                          style={{
                            width: `${Math.round(Number(book.progress_percent) || 0)}%`,
                          }}
                        />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        {book.current_lesson_id ? (
                          <Link
                            href={`/s/${accessCode}/lesson/${book.current_lesson_id}`}
                            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                          >
                            Continue
                          </Link>
                        ) : null}

                        {book.source_documents?.id ? (
                          <Link
                            href={`/s/${accessCode}/book/${book.source_documents.id}`}
                            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900"
                          >
                            Open Book
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-500">
              No book progress yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
