import Link from "next/link";
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
                <div className="min-w-0">
                  <div className="app-kicker text-slate-500">Current Reading</div>
                  <h2 className="app-heading-md mt-1">{data.featuredBook.title}</h2>
                  <p className="app-copy mt-1">
                    {data.featuredBook.author ?? "Unknown author"}
                  </p>
                </div>

                <div className="app-chip">
                  {Math.round(data.featuredBook.progressPercent)}%
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div>
                  <div className="app-kicker text-slate-500">Progress</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950">
                    {Math.round(data.featuredBook.progressPercent)}%
                  </div>
                </div>
                <div>
                  <div className="app-kicker text-slate-500">Completed</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950">
                    {data.featuredBook.completedLessonsCount}
                  </div>
                </div>
                <div>
                  <div className="app-kicker text-slate-500">Lessons</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950">
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
                    href={`/s/${code}/lesson/${data.featuredBook.currentLessonId}`}
                    className="primary-button flex-1"
                  >
                    Continue Reading
                  </Link>
                ) : null}

                <Link
                  href={`/s/${code}/book/${data.featuredBook.sourceDocumentId}`}
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
          <div className="text-sm font-semibold text-slate-500">{data.books.length}</div>
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
                    : "border-[var(--color-border)] bg-white text-slate-950"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div
                      className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                        book.isCurrent ? "text-white/60" : "text-slate-500"
                      }`}
                    >
                      {book.isCurrent ? "Current" : "Book"}
                    </div>
                    <h3 className="mt-1 text-lg font-semibold">{book.title}</h3>
                    <div className={book.isCurrent ? "mt-1 text-sm text-white/75" : "mt-1 text-sm text-slate-600"}>
                      {book.author ?? "Unknown author"}
                    </div>
                  </div>

                  <div className={book.isCurrent ? "app-chip bg-white/10 text-white" : "app-chip"}>
                    {Math.round(book.progressPercent)}%
                  </div>
                </div>

                <div className={book.isCurrent ? "mt-3 text-sm text-white/75" : "mt-3 text-sm text-slate-600"}>
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
                      href={`/s/${code}/lesson/${book.currentLessonId}`}
                      className={book.isCurrent ? "secondary-button flex-1 bg-white text-slate-950" : "primary-button flex-1"}
                    >
                      Continue Reading
                    </Link>
                  ) : null}

                  <Link
                    href={`/s/${code}/book/${book.sourceDocumentId}`}
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
