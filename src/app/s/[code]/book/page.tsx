import Link from "next/link";
import { getBooksPageData } from "@/services/reading/books-page.service";

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
      <div
        className="h-full rounded-full bg-slate-900"
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
    <div className="px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Books</h1>
          <p className="mt-2 text-slate-600">
            Kindle-style library with chapter-aware reading progress for {data.student.fullName}.
          </p>
        </div>

        {data.featuredBook ? (
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <div className="grid gap-6 p-6 md:grid-cols-[1.2fr_0.8fr] md:p-8">
              <div className="space-y-4">
                <div className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">
                  Continue Reading
                </div>

                <div>
                  <h2 className="text-3xl font-semibold text-slate-900">
                    {data.featuredBook.title}
                  </h2>
                  <p className="mt-2 text-slate-600">
                    {data.featuredBook.author ?? "Unknown author"}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-sm text-slate-500">Progress</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">
                      {Math.round(data.featuredBook.progressPercent)}%
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-sm text-slate-500">Completed</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">
                      {data.featuredBook.completedLessonsCount}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-sm text-slate-500">Total lessons</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">
                      {data.featuredBook.totalLessonsCount}
                    </div>
                  </div>
                </div>

                <ProgressBar value={data.featuredBook.progressPercent} />

                <div className="flex flex-wrap gap-3">
                  {data.featuredBook.currentLessonId ? (
                    <Link
                      href={`/s/${code}/lesson/${data.featuredBook.currentLessonId}`}
                      className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
                    >
                      Continue Reading
                    </Link>
                  ) : null}

                  <Link
                    href={`/s/${code}/book/${data.featuredBook.sourceDocumentId}`}
                    className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900"
                  >
                    Open Book
                  </Link>
                </div>
              </div>

              <div className="rounded-[2rem] bg-slate-900 p-6 text-white">
                <div className="text-sm uppercase tracking-[0.18em] text-slate-300">
                  Current book
                </div>
                <div className="mt-4 text-2xl font-semibold">
                  {data.featuredBook.title}
                </div>
                <div className="mt-2 text-sm text-slate-300">
                  {data.featuredBook.completedLessonsCount} of {data.featuredBook.totalLessonsCount} lessons completed
                </div>
                <div className="mt-6 rounded-2xl bg-white/10 p-4 text-sm text-slate-200">
                  Your current book stays at the top, with a direct resume action and progress-first library layout.
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className="rounded-3xl border bg-white p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Library</h2>
              <p className="mt-1 text-sm text-slate-600">
                In-progress books come first, then the rest by recent activity.
              </p>
            </div>
            <div className="text-sm text-slate-500">{data.books.length} books</div>
          </div>

          {data.books.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-slate-600">
              No books are available yet.
            </div>
          ) : (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {data.books.map((book) => (
                <article
                  key={book.sourceDocumentId}
                  className={`rounded-3xl border p-5 ${
                    book.isCurrent
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-900"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div
                        className={`text-xs font-semibold uppercase tracking-[0.18em] ${
                          book.isCurrent ? "text-slate-300" : "text-slate-500"
                        }`}
                      >
                        {book.isCurrent ? "Current Book" : "Book"}
                      </div>
                      <h3 className="mt-3 text-2xl font-semibold">{book.title}</h3>
                      <p className={`mt-2 text-sm ${book.isCurrent ? "text-slate-300" : "text-slate-600"}`}>
                        {book.author ?? "Unknown author"}
                      </p>
                    </div>

                    <div
                      className={`rounded-2xl px-3 py-2 text-sm font-semibold ${
                        book.isCurrent ? "bg-white/10 text-white" : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {Math.round(book.progressPercent)}%
                    </div>
                  </div>

                  <div className={`mt-5 text-sm ${book.isCurrent ? "text-slate-300" : "text-slate-600"}`}>
                    {book.completedLessonsCount} / {book.totalLessonsCount} lessons completed
                  </div>

                  <div className="mt-4">
                    <div className={`h-2.5 w-full overflow-hidden rounded-full ${book.isCurrent ? "bg-white/15" : "bg-slate-200"}`}>
                      <div
                        className={`h-full rounded-full ${book.isCurrent ? "bg-white" : "bg-slate-900"}`}
                        style={{ width: `${Math.max(0, Math.min(100, book.progressPercent))}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    {book.currentLessonId ? (
                      <Link
                        href={`/s/${code}/lesson/${book.currentLessonId}`}
                        className={`rounded-2xl px-4 py-2 text-sm font-semibold ${
                          book.isCurrent ? "bg-white text-slate-900" : "bg-slate-900 text-white"
                        }`}
                      >
                        Continue Reading
                      </Link>
                    ) : null}

                    <Link
                      href={`/s/${code}/book/${book.sourceDocumentId}`}
                      className={`rounded-2xl border px-4 py-2 text-sm font-semibold ${
                        book.isCurrent
                          ? "border-white/25 bg-transparent text-white"
                          : "border-slate-300 bg-white text-slate-900"
                      }`}
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
    </div>
  );
}
