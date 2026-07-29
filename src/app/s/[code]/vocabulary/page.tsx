import Link from "next/link";
import VocabularyAudioPrefetch from "@/components/student/VocabularyAudioPrefetch";
import {
  studentDashboardPath,
  studentMistakeBrainPath,
  studentVocabularyDrillPath,
  studentVocabularyListPath,
} from "@/lib/routes/student";
import {
  normalizeVocabularyLessonId,
  getStudentVocabularyPageData,
  normalizeVocabularyPageMode,
  normalizeVocabularySessionPhase,
} from "@/services/vocabulary/vocabulary-page.service";
import ReadingCoachBrand from "@/components/student/ReadingCoachBrand";

export default async function StudentVocabularyPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ mode?: string; phase?: string; lesson?: string }>;
}) {
  const [{ code }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const selectedMode = normalizeVocabularyPageMode(resolvedSearchParams.mode);
  const selectedPhase = normalizeVocabularySessionPhase(resolvedSearchParams.phase);
  const preferredLessonId = normalizeVocabularyLessonId(resolvedSearchParams.lesson);
  const data = await getStudentVocabularyPageData(
    code,
    selectedMode,
    selectedPhase,
    preferredLessonId
  );

  const {
    student,
    dashboard,
    summary,
    preparationNeeded,
  } = data;
  const primaryPracticeHref = studentVocabularyDrillPath({
    mode: "mixed_practice",
    phase: summary.activePhase ?? undefined,
    lesson: summary.lessonFocus?.lessonId ?? undefined,
  });
  const weakWordsHref = studentVocabularyDrillPath({
    mode: "review_weak_words",
    phase: "endless_continuation",
    lesson: summary.lessonFocus?.lessonId ?? undefined,
  });
  const primaryActionLabel =
    summary.activePhase === "endless_continuation" ? "Continue Practice" : "Start Practice";

  const topMetrics = [
    {
      label: "Captured",
      value: dashboard.totals.totalTrackedWords,
    },
    {
      label: "Mastered",
      value: dashboard.totals.masteredWords,
    },
    {
      label: "Practiced today",
      value: dashboard.totals.practicedTodayWords,
    },
  ];

  return (
    <div className="app-page-shell max-w-4xl space-y-5">
      <header className="coach-topbar">
        <ReadingCoachBrand compact />
        <Link href={studentDashboardPath()} className="coach-secondary-button">Dashboard</Link>
      </header>
      <section className="coach-vocab-hero">
        <div className="space-y-5">
          <div className="space-y-1">
            <div className="coach-eyebrow">Vocabulary studio</div>
            <h1 className="coach-page-title !text-[clamp(2rem,7vw,3rem)]">Build your word power.</h1>
            <p className="coach-page-copy">Short adaptive sessions strengthen meaning, context, and recall.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {topMetrics.map((item) => (
              <div key={item.label} className="coach-stat">
                <div className="app-kicker text-slate-500">{item.label}</div>
                <div className="app-metric-value mt-2">{item.value}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href={primaryPracticeHref} className="coach-primary-button coach-primary-button--blue flex-1">
              {primaryActionLabel}
            </Link>
            <Link href={weakWordsHref} className="coach-secondary-button flex-1 sm:flex-none">
              Review Weak Words
            </Link>
            <Link href={studentVocabularyListPath()} className="coach-secondary-button flex-1 sm:flex-none">
              My Vocabulary
            </Link>
          </div>

          <div>
            <Link
              href={studentMistakeBrainPath()}
              className="text-sm font-semibold text-slate-600 underline underline-offset-4"
            >
              View Insights
            </Link>
          </div>
        </div>
      </section>

      <VocabularyAudioPrefetch
        studentId={student.id}
        lessonId={summary.audioPreparation.topPrepLesson?.lessonId ?? null}
        lessonName={summary.audioPreparation.topPrepLesson?.lessonName ?? null}
        pendingCount={
          summary.audioPreparation.pendingCount +
          summary.audioPreparation.failedCount +
          summary.audioPreparation.missingCount
        }
        readyCount={summary.audioPreparation.listenReadyWordCount}
      />

      {preparationNeeded ? (
        <section className="card-surface p-4 sm:p-5">
          <div className="app-kicker">Preparing words</div>
        </section>
      ) : null}
    </div>
  );
}
