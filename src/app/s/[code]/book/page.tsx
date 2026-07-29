import Link from "next/link";
import { studentBookDetailPath, studentDashboardPath, studentLessonPath } from "@/lib/routes/student";
import { getBooksPageData } from "@/services/reading/books-page.service";
import { SelectBookButton } from "@/components/student/SelectBookButton";
import ReadingCoachBrand from "@/components/student/ReadingCoachBrand";

export default async function StudentBookPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const data = await getBooksPageData(code);
  const featured = data.featuredBook;

  return (
    <div className="content-shell max-w-6xl">
      <header className="coach-topbar">
        <ReadingCoachBrand compact />
        <Link href={studentDashboardPath()} className="coach-secondary-button">Dashboard</Link>
      </header>

      <div className="mt-7">
        <div className="coach-eyebrow">Library</div>
        <h1 className="coach-page-title">Choose your next journey.</h1>
        <p className="coach-page-copy">Every book keeps its own reading path and progress.</p>
      </div>

      {featured ? (
        <section className="coach-library-featured">
          <div className="coach-library-cover">
            {featured.coverImagePath ? (
              <img src={featured.coverImagePath} alt={`${featured.title} cover`} />
            ) : (
              <div className="coach-cover-fallback">📖</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="coach-eyebrow">Continue reading</div>
            <h2>{featured.title}</h2>
            <p>{featured.author ?? "Unknown author"}</p>
            <div className="mt-5 flex justify-between text-sm font-bold">
              <span>{Math.round(featured.progressPercent)}% complete</span>
              <span className="text-slate-500">{featured.completedLessonsCount}/{featured.totalLessonsCount} lessons</span>
            </div>
            <div className="coach-progress mt-2"><span style={{ width: `${featured.progressPercent}%` }} /></div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              {featured.currentLessonId ? (
                <Link href={studentLessonPath(featured.currentLessonId)} className="coach-primary-button">
                  Continue reading <span>›</span>
                </Link>
              ) : null}
              <Link href={studentBookDetailPath(featured.sourceDocumentId)} className="coach-secondary-button">View path</Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className="mt-9">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="coach-eyebrow">All books</div>
            <h2 className="font-[var(--font-display)] text-2xl font-extrabold tracking-[-0.03em]">Your reading library</h2>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">{data.books.length}</span>
        </div>

        {data.books.length === 0 ? (
          <div className="coach-empty-state">
            <div className="coach-empty-art coach-empty-art--books">
              <img src="/brand/empty-states.png" alt="" />
            </div>
            <h3>No books yet</h3>
            <p>Your reading library will appear here.</p>
          </div>
        ) : (
          <div className="coach-library-grid">
            {data.books.map((book) => (
              <article key={book.sourceDocumentId} className={`coach-library-card ${book.isCurrent ? "coach-library-card--current" : ""}`}>
                <Link href={studentBookDetailPath(book.sourceDocumentId)} className="coach-library-card-cover">
                  {book.coverImagePath ? (
                    <img src={book.coverImagePath} alt={`${book.title} cover`} />
                  ) : (
                    <div className="coach-cover-fallback">📘</div>
                  )}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="coach-eyebrow">{book.isCurrent ? "Current book" : "Book"}</div>
                  <h3>{book.title}</h3>
                  <p>{book.author ?? "Unknown author"}</p>
                  <div className="mt-auto pt-4">
                    <div className="flex justify-between text-xs font-bold">
                      <span>{Math.round(book.progressPercent)}%</span>
                      <span className="text-slate-500">{book.completedLessonsCount}/{book.totalLessonsCount}</span>
                    </div>
                    <div className="coach-progress mt-2"><span style={{ width: `${book.progressPercent}%` }} /></div>
                    <div className="mt-4 grid gap-2">
                      <SelectBookButton studentId={data.student.id} sourceDocumentId={book.sourceDocumentId} isCurrent={book.isCurrent} />
                      <Link href={studentBookDetailPath(book.sourceDocumentId)} className="coach-secondary-button">Open reading path</Link>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
