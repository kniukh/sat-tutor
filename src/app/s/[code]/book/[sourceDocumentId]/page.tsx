import Link from "next/link";
import { studentBookLibraryPath, studentDashboardPath } from "@/lib/routes/student";
import { getBookDetailData } from "@/services/reading/book-detail.service";

function getStatusClasses(status: "completed" | "current" | "available") {
  if (status === "current") {
    return {
      card: "border-slate-900 bg-slate-900 text-white",
      badge: "bg-white text-slate-950",
      meta: "text-white/70",
      button: "secondary-button bg-white text-slate-950",
    };
  }

  if (status === "completed") {
    return {
      card: "border-[var(--color-border)] bg-[var(--color-surface-muted)] text-slate-950",
      badge: "bg-slate-900 text-white",
      meta: "text-slate-600",
      button: "secondary-button",
    };
  }

  return {
    card: "border-[var(--color-border)] bg-white text-slate-950",
    badge: "bg-slate-100 text-slate-700",
    meta: "text-slate-600",
    button: "primary-button",
  };
}

export default async function StudentBookDetailPage({
  params,
}: {
  params: Promise<{ code: string; sourceDocumentId: string }>;
}) {
  const { code, sourceDocumentId } = await params;
  const data = await getBookDetailData({ accessCode: code, sourceDocumentId });
  const progressPercent = Math.round(data.progress?.progressPercent ?? 0);

  return (
    <div className="content-shell max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
        <Link href={studentDashboardPath()} className="underline underline-offset-4">
          Dashboard
        </Link>
        <span>/</span>
        <Link href={studentBookLibraryPath()} className="underline underline-offset-4">
          Books
        </Link>
      </div>

      <section className="card-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <div className="surface-soft-panel flex h-28 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[1.35rem]">
              {data.book.coverImagePath ? (
                <img
                  src={data.book.coverImagePath}
                  alt={`${data.book.title} cover`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="app-kicker token-text-muted text-center">Cover</div>
              )}
            </div>

            <div className="min-w-0">
              <div className="app-kicker">Book</div>
              <h1 className="app-heading-lg mt-1">{data.book.title}</h1>
              <p className="app-copy mt-1">{data.book.author ?? "Unknown author"}</p>
            </div>
          </div>

          <div className="app-chip">{progressPercent}%</div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="app-card-soft p-4">
            <div className="app-kicker token-text-muted">Progress</div>
            <div className="token-text-primary mt-2 text-2xl font-semibold">{progressPercent}%</div>
          </div>
          <div className="app-card-soft p-4">
            <div className="app-kicker token-text-muted">Completed</div>
            <div className="token-text-primary mt-2 text-2xl font-semibold">
              {data.progress?.completedLessonsCount ?? 0}
            </div>
          </div>
          <div className="app-card-soft p-4">
            <div className="app-kicker token-text-muted">Lessons</div>
            <div className="token-text-primary mt-2 text-2xl font-semibold">
              {data.progress?.totalLessonsCount ?? 0}
            </div>
          </div>
        </div>

        <div className="mt-4 progress-track">
          <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>

        {data.continueLessonHref ? (
          <div className="mt-5">
            <Link href={data.continueLessonHref} className="primary-button w-full sm:w-auto">
              Continue Reading
            </Link>
          </div>
        ) : null}
      </section>

      <section className="card-surface p-5 sm:p-6">
        <div>
          <div className="app-kicker">Reading Path</div>
          <h2 className="app-heading-md mt-1">Lessons by chapter</h2>
        </div>

        {data.chapters.length === 0 ? (
          <div className="mt-5 app-card-soft p-5">
            <div className="app-copy">No lessons are available for this book yet.</div>
          </div>
        ) : (
          <div className="mt-5 space-y-6">
            {data.chapters.map((chapter) => (
              <section
                key={`${chapter.chapterIndex ?? "none"}-${chapter.chapterTitle}`}
                className="space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-[var(--color-border)]" />
                  <div className="app-chip">{chapter.chapterTitle}</div>
                  <div className="h-px flex-1 bg-[var(--color-border)]" />
                </div>

                <div className="space-y-3">
                  {chapter.lessons.map((lesson) => {
                    const styles = getStatusClasses(lesson.status);

                    return (
                      <article
                        key={lesson.lessonId}
                        className={`rounded-[1.5rem] border p-4 ${styles.card}`}
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${styles.badge}`}>
                                {lesson.status === "completed"
                                  ? "Completed"
                                  : lesson.status === "current"
                                    ? "Current"
                                    : "Available"}
                              </span>
                            </div>

                            <h3 className="mt-3 text-lg font-semibold">{lesson.name}</h3>
                            <p className={`mt-1 text-sm ${styles.meta}`}>
                              {chapter.chapterTitle}
                              {lesson.displayOrder !== null ? ` · Lesson ${lesson.displayOrder}` : ""}
                            </p>
                          </div>

                          <Link href={lesson.href} className={styles.button}>
                            {lesson.status === "current" ? "Continue" : "Open Lesson"}
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
