import Link from "next/link";
import { studentBookDetailPath, studentLessonPath } from "@/lib/routes/student";
import { getBooksPageData } from "@/services/reading/books-page.service";

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="progress-track">
      <div
        className="progress-fill"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export default async function StudentBookPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const data = await getBooksPageData(code);

  return (
    <div className="content-shell max-w-5xl space-y-5">
      <section className="card-surface p-5 sm:p-6">
        <div className="space-y-2">
          <div className="app-kicker">Library</div>
          <h1 className="app-heading-lg">Pick up your reading.</h1>
          <p className="app-copy">
            Continue your current book or open another reading path.
          </p>
        </div>

        {data.featuredBook ? (
          <div className="mt-5 space-y-4">
            <div className="app-card-soft p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="surface-soft-panel flex h-24 w-18 shrink-0 items-center justify-center overflow-hidden rounded-[1.25rem]">
                    {data.featuredBook.coverImagePath ? (
                      <img
                        src={data.featuredBook.coverImagePath}
                        alt={`${data.featuredBook.title} cover`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="app-kicker token-text-muted text-center">Cover</div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="app-kicker token-text-muted">Current Reading</div>
                    <h2 className="app-heading-md mt-1">{data.featuredBook.title}</h2>
                    <p className="app-copy mt-1">
                      {data.featuredBook.author ?? "Unknown author"}
                    </p>
                  </div>
                </div>

                <div className="app-chip">
                  {Math.round(data.featuredBook.progressPercent)}%
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div>
                  <div className="app-kicker token-text-muted">Progress</div>
                  <div className="token-text-primary mt-2 text-2xl font-semibold">
                    {Math.round(data.featuredBook.progressPercent)}%
                  </div>
                </div>
                <div>
                  <div className="app-kicker token-text-muted">Completed</div>
                  <div className="token-text-primary mt-2 text-2xl font-semibold">
                    {data.featuredBook.completedLessonsCount}
                  </div>
                </div>
                <div>
                  <div className="app-kicker token-text-muted">Lessons</div>
                  <div className="token-text-primary mt-2 text-2xl font-semibold">
                    {data.featuredBook.totalLessonsCount}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <ProgressBar value={data.featuredBook.progressPercent} />
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                {data.featuredBook.currentLessonId ? (
                  <Link
                    href={studentLessonPath(data.featuredBook.currentLessonId)}
                    className="primary-button flex-1"
                  >
                    Continue Reading
                  </Link>
                ) : null}

                <Link
                  href={studentBookDetailPath(data.featuredBook.sourceDocumentId)}
                  className="secondary-button flex-1 sm:flex-none"
                >
                  Open Book
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 app-card-soft p-5">
            <div className="app-copy">No current book yet. Open any available book to start reading.</div>
          </div>
        )}
      </section>

      <section className="card-surface p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="app-kicker">Books</div>
            <h2 className="app-heading-md mt-1">Your reading library</h2>
          </div>
          <div className="token-text-muted text-sm font-semibold">{data.books.length}</div>
        </div>

        {data.books.length === 0 ? (
          <div className="mt-5 app-card-soft p-5">
            <div className="app-copy">No books are available yet.</div>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {data.books.map((book) => (
              <article
                key={book.sourceDocumentId}
                className={`rounded-[1.5rem] border p-4 ${
                  book.isCurrent
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "surface-panel token-text-primary"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-4">
                    <div
                      className={`flex h-24 w-18 shrink-0 items-center justify-center overflow-hidden rounded-[1.25rem] ${
                        book.isCurrent ? "bg-white/10" : "surface-soft-panel"
                      }`}
                    >
                      {book.coverImagePath ? (
                        <img
                          src={book.coverImagePath}
                          alt={`${book.title} cover`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className={book.isCurrent ? "app-kicker text-white/55" : "app-kicker token-text-muted"}>
                          Cover
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                    <div
                      className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                        book.isCurrent ? "text-white/60" : "token-text-muted"
                      }`}
                    >
                      {book.isCurrent ? "Current" : "Book"}
                    </div>
                    <h3 className="mt-1 text-lg font-semibold">{book.title}</h3>
                    <div className={book.isCurrent ? "mt-1 text-sm text-white/75" : "token-text-secondary mt-1 text-sm"}>
                      {book.author ?? "Unknown author"}
                    </div>
                    </div>
                  </div>

                  <div className={book.isCurrent ? "app-chip bg-white/10 text-white" : "app-chip"}>
                    {Math.round(book.progressPercent)}%
                  </div>
                </div>

                <div className={book.isCurrent ? "mt-3 text-sm text-white/75" : "token-text-secondary mt-3 text-sm"}>
                  {book.completedLessonsCount} / {book.totalLessonsCount} lessons completed
                </div>

                <div className="mt-3">
                  <div className={book.isCurrent ? "h-2 w-full overflow-hidden rounded-full bg-white/15" : "progress-track"}>
                    <div
                      className={book.isCurrent ? "h-full rounded-full bg-white" : "progress-fill"}
                      style={{ width: `${Math.max(0, Math.min(100, book.progressPercent))}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  {book.currentLessonId ? (
                    <Link
                      href={studentLessonPath(book.currentLessonId)}
                      className={book.isCurrent ? "secondary-button flex-1 bg-white text-slate-950" : "primary-button flex-1"}
                    >
                      Continue Reading
                    </Link>
                  ) : null}

                  <Link
                    href={studentBookDetailPath(book.sourceDocumentId)}
                    className={book.isCurrent ? "secondary-button flex-1 border-white/20 bg-transparent text-white" : "secondary-button flex-1"}
                  >
                    Open Book
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
