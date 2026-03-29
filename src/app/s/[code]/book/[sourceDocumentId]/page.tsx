import Link from "next/link";
import { getBookDetailData } from "@/services/reading/book-detail.service";

function getStatusClasses(status: "completed" | "current" | "available") {
  if (status === "current") {
    return {
      card: "border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-200",
      badge: "bg-white text-slate-900",
      dot: "bg-amber-400",
    };
  }

  if (status === "completed") {
    return {
      card: "border-slate-200 bg-slate-50 text-slate-900",
      badge: "bg-slate-900 text-white",
      dot: "bg-emerald-500",
    };
  }

  return {
    card: "border-slate-200 bg-white text-slate-900",
    badge: "bg-slate-100 text-slate-700",
    dot: "bg-slate-300",
  };
}

export default async function StudentBookDetailPage({
  params,
}: {
  params: Promise<{ code: string; sourceDocumentId: string }>;
}) {
  const { code, sourceDocumentId } = await params;
  const data = await getBookDetailData({ accessCode: code, sourceDocumentId });

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <Link href={`/s/${code}`} className="underline">
            Dashboard
          </Link>
          <span>/</span>
          <Link href={`/s/${code}/book`} className="underline">
            Books
          </Link>
          <span>/</span>
          <span className="text-slate-900">{data.book.title}</span>
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <div className="grid gap-6 p-6 md:grid-cols-[1.2fr_0.8fr] md:p-8">
            <div className="space-y-5">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Book Detail
                </div>
                <h1 className="mt-3 text-4xl font-semibold text-slate-900">
                  {data.book.title}
                </h1>
                <p className="mt-2 text-slate-600">
                  {data.book.author ?? "Unknown author"}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">Overall progress</div>
                  <div className="mt-2 text-3xl font-semibold text-slate-900">
                    {Math.round(data.progress?.progressPercent ?? 0)}%
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">Completed lessons</div>
                  <div className="mt-2 text-3xl font-semibold text-slate-900">
                    {data.progress?.completedLessonsCount ?? 0}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">Total lessons</div>
                  <div className="mt-2 text-3xl font-semibold text-slate-900">
                    {data.progress?.totalLessonsCount ?? 0}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>Reading progress</span>
                  <span>{Math.round(data.progress?.progressPercent ?? 0)}%</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-slate-900"
                    style={{
                      width: `${Math.max(0, Math.min(100, data.progress?.progressPercent ?? 0))}%`,
                    }}
                  />
                </div>
              </div>

              {data.continueLessonHref ? (
                <div className="pt-2">
                  <Link
                    href={data.continueLessonHref}
                    className="inline-flex rounded-2xl bg-slate-900 px-6 py-4 text-base font-semibold text-white"
                  >
                    Continue Reading
                  </Link>
                </div>
              ) : null}
            </div>

            <div className="rounded-[2rem] bg-amber-50 p-6">
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-800">
                Guided path
              </div>
              <div className="mt-4 text-2xl font-semibold text-slate-900">
                Chapter-based reading flow
              </div>
              <div className="mt-3 text-sm leading-6 text-slate-700">
                Lessons stay grouped by chapter so the book still feels linear, while your current lesson stays easy to spot and resume.
              </div>
              <div className="mt-6 rounded-2xl bg-white p-4 text-sm text-slate-700">
                {data.chapters.length} chapters
                {" · "}
                {data.progress?.completedLessonsCount ?? 0} completed
                {" · "}
                {data.progress?.totalLessonsCount ?? 0} total
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border bg-white p-6">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Reading Path</h2>
            <p className="mt-1 text-sm text-slate-600">
              Duolingo-inspired flow, grouped by chapter instead of one flat lesson list.
            </p>
          </div>

          {data.chapters.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-slate-600">
              No lessons are available for this book yet.
            </div>
          ) : (
            <div className="mt-8 space-y-8">
              {data.chapters.map((chapter) => (
                <section
                  key={`${chapter.chapterIndex ?? "none"}-${chapter.chapterTitle}`}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-slate-200" />
                    <div className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                      {chapter.chapterTitle}
                    </div>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>

                  <div className="space-y-4">
                    {chapter.lessons.map((lesson, index) => {
                      const styles = getStatusClasses(lesson.status);

                      return (
                        <div key={lesson.lessonId} className="relative pl-10">
                          {index < chapter.lessons.length - 1 ? (
                            <div className="absolute left-[15px] top-10 h-[calc(100%+0.75rem)] w-px bg-slate-200" />
                          ) : null}

                          <div
                            className={`absolute left-0 top-6 h-8 w-8 rounded-full border-4 border-white ${styles.dot}`}
                          />

                          <article className={`rounded-3xl border p-5 ${styles.card}`}>
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${styles.badge}`}
                                  >
                                    {lesson.status === "completed"
                                      ? "Completed"
                                      : lesson.status === "current"
                                        ? "Current"
                                        : "Available"}
                                  </span>

                                  {lesson.lessonType ? (
                                    <span className="text-xs uppercase tracking-[0.14em] text-slate-500">
                                      {lesson.lessonType}
                                    </span>
                                  ) : null}
                                </div>

                                <h3 className="mt-3 text-xl font-semibold">{lesson.name}</h3>
                                <p
                                  className={`mt-2 text-sm ${
                                    lesson.status === "current" ? "text-slate-200" : "text-slate-600"
                                  }`}
                                >
                                  {chapter.chapterTitle}
                                  {lesson.displayOrder !== null ? ` · Lesson ${lesson.displayOrder}` : ""}
                                </p>
                              </div>

                              <div>
                                <Link
                                  href={lesson.href}
                                  className={`inline-flex rounded-2xl px-4 py-2 text-sm font-semibold ${
                                    lesson.status === "current"
                                      ? "bg-white text-slate-900"
                                      : "bg-slate-900 text-white"
                                  }`}
                                >
                                  {lesson.status === "current" ? "Continue" : "Open Lesson"}
                                </Link>
                              </div>
                            </div>
                          </article>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
