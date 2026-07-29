import Link from "next/link";
import { studentBookLibraryPath, studentDashboardPath } from "@/lib/routes/student";
import { getBookDetailData } from "@/services/reading/book-detail.service";
import ReadingCoachBrand from "@/components/student/ReadingCoachBrand";

function BookGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path d="M3.5 5.5c3.5-1.2 6.3-.5 8.5 1.7v12c-2.2-2.2-5-2.9-8.5-1.7v-12Zm17 0c-3.5-1.2-6.3-.5-8.5 1.7v12c2.2-2.2 5-2.9 8.5-1.7v-12Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
    </svg>
  );
}

export default async function StudentBookDetailPage({
  params,
}: {
  params: Promise<{ code: string; sourceDocumentId: string }>;
}) {
  const { code, sourceDocumentId } = await params;
  const data = await getBookDetailData({ accessCode: code, sourceDocumentId });
  const progress = Math.round(data.progress?.progressPercent ?? 0);

  return (
    <div className="content-shell max-w-4xl pb-32">
      <header className="coach-topbar">
        <ReadingCoachBrand compact />
        <Link href={studentBookLibraryPath()} className="coach-secondary-button">Library</Link>
      </header>

      <section className="coach-book-hero">
        <Link href={studentDashboardPath()} className="coach-back-button" aria-label="Back to dashboard">←</Link>
        <div className="coach-book-cover">
          {data.book.coverImagePath ? (
            <img src={data.book.coverImagePath} alt={`${data.book.title} cover`} />
          ) : (
            <div className="coach-cover-fallback"><BookGlyph /></div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="coach-eyebrow"><BookGlyph /> Book</div>
          <h1 className="coach-page-title !text-[clamp(1.7rem,6vw,2.7rem)]">{data.book.title}</h1>
          <p className="coach-page-copy">{data.book.author ?? "Unknown author"}</p>
          <div className="mt-5 flex items-center justify-between gap-3 text-sm font-bold">
            <span>{progress}% complete</span>
            <span className="text-slate-500">{data.progress?.completedLessonsCount ?? 0}/{data.progress?.totalLessonsCount ?? 0}</span>
          </div>
          <div className="coach-progress mt-2"><span style={{ width: `${progress}%` }} /></div>
        </div>
      </section>

      <main className="coach-path">
        {data.chapters.map((chapter, chapterIndex) => (
          <section key={`${chapter.chapterIndex}-${chapter.chapterTitle}`} className="coach-chapter">
            <header className="coach-chapter-header">
              <span className="text-blue-600"><BookGlyph /></span>
              <div>
                <h2>Chapter {chapter.chapterIndex ?? chapterIndex + 1}</h2>
                <p>{chapter.chapterTitle.replace(/^Chapter\s*\d+\s*[—:-]?\s*/i, "") || "Reading journey"}</p>
              </div>
            </header>

            <div className="coach-path-list">
              {chapter.lessons.map((lesson, index) => {
                const locked = lesson.status === "locked";
                const node = (
                  <span className={`coach-path-node coach-path-node--${lesson.status}`}>
                    {lesson.status === "completed" ? "✓" : locked ? "🔒" : index + 1}
                  </span>
                );
                return (
                  <div key={lesson.lessonId} className={`coach-path-step coach-path-step--${index % 2 ? "right" : "left"}`}>
                    {locked ? node : <Link href={lesson.href} aria-label={`${lesson.status}: ${lesson.name}`}>{node}</Link>}
                    <div className={`coach-path-label coach-path-label--${lesson.status}`}>
                      <strong>{lesson.name.replace(/^Chapter\s*\d+\s*[—:-]\s*/i, "")}</strong>
                      <span>
                        {lesson.status === "completed" ? "Completed · Replay anytime" :
                          lesson.status === "current" ? "You’re here · Continue reading" :
                          lesson.status === "locked" ? "Complete the previous part to unlock" : "Available"}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div className="coach-checkpoint">
                <div className="coach-checkpoint-icon">🏆</div>
                <div><strong>Chapter checkpoint</strong><span>Complete the chapter and celebrate your progress.</span></div>
              </div>
            </div>
          </section>
        ))}
      </main>

      {data.continueLessonHref ? (
        <div className="coach-sticky-action">
          <Link href={data.continueLessonHref} className="coach-primary-button">
            <BookGlyph /> Continue reading <span>›</span>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
