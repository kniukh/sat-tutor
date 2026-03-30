import Link from "next/link";
import VocabularyAudioPrefetch from "@/components/student/VocabularyAudioPrefetch";
import {
  getStudentVocabularyPageData,
  normalizeVocabularyPageMode,
  type VocabularyPageMode,
} from "@/services/vocabulary/vocabulary-page.service";

const MODE_OPTIONS: Array<{
  mode: VocabularyPageMode;
  label: string;
}> = [
  {
    mode: "learn_new_words",
    label: "New",
  },
  {
    mode: "review_weak_words",
    label: "Weak",
  },
  {
    mode: "mixed_practice",
    label: "Mixed",
  },
];

export default async function StudentVocabularyPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const [{ code }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const selectedMode = normalizeVocabularyPageMode(resolvedSearchParams.mode);
  const data = await getStudentVocabularyPageData(code, selectedMode);

  const {
    student,
    dashboard,
    summary,
    session,
    preparationNeeded,
  } = data;

  const topMetrics = [
    {
      label: "Due now",
      value: dashboard.reviewIndicators.dueNow,
    },
    {
      label: "Overdue",
      value: dashboard.reviewIndicators.overdueRetentionChecks,
    },
    {
      label: "Weak words",
      value: dashboard.reviewIndicators.weakReinforcement,
    },
    {
      label: "New words",
      value: summary.newWordPoolCount,
    },
  ];

  const masteryChips = dashboard.masteryDistribution
    .slice()
    .sort((left, right) => right.count - left.count)
    .slice(0, 3)
    .map((item) => ({
      label: item.lifecycleState.replace(/_/g, " "),
      count: item.count,
    }));

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-5 sm:px-6 sm:py-6">
      <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="space-y-4">
          <div className="space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Vocabulary Studio
            </div>
            <h1 className="text-2xl font-semibold text-slate-950">Ready now</h1>
            <p className="text-sm leading-6 text-slate-600">
              {selectedMode === "learn_new_words"
                ? `${summary.newWordPoolCount} fresh words are ready to start.`
                : `${summary.readyDrillsCount} exercises are ready, led by ${
                    summary.topPriorityLabel?.toLowerCase() ?? "today's due words"
                  }.`}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {topMetrics.map((item) => (
              <div key={item.label} className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {item.label}
                </div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">{item.value}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
              {dashboard.totals.totalTrackedWords} tracked
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
              streak {dashboard.streak.current}
            </span>
            {masteryChips.map((item) => (
              <span
                key={item.label}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 capitalize"
              >
                {item.label} {item.count}
              </span>
            ))}
            {selectedMode === "learn_new_words" &&
            summary.learnNewWords.newestCapturedItems.length > 0 ? (
              <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sky-800">
                {summary.learnNewWords.newestCapturedItems[0]} first
              </span>
            ) : null}
          </div>

          <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1">
            {MODE_OPTIONS.map((option) => {
              const isActive = option.mode === selectedMode;

              return (
                <Link
                  key={option.mode}
                  href={`/s/${student.accessCode}/vocabulary?mode=${option.mode}`}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    isActive
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {option.label}
                </Link>
              );
            })}
          </div>

          {selectedMode === "learn_new_words" && summary.learnNewWords.recentLessons.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {summary.learnNewWords.recentLessons.slice(0, 3).map((lesson) => (
                <span
                  key={lesson.lessonId}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
                >
                  {lesson.lessonName} {lesson.readyNewWordCount}
                </span>
              ))}
            </div>
          ) : null}
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
        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Syncing
            </div>
            <p className="text-sm leading-6 text-slate-600">
              {selectedMode === "learn_new_words"
                ? "Fresh vocabulary from your reading is being prepared automatically. It should appear here as soon as processing finishes."
                : "Your review queue is syncing answer sets automatically. If today's words are still processing, refresh in a moment."}
            </p>
          </div>
        </section>
      ) : null}

      {session ? (
        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Ready To Start
            </div>
            <h2 className="text-2xl font-semibold text-slate-950">Focused drill session</h2>
            <p className="text-sm leading-6 text-slate-600">
              Launch a clean, full-screen practice run with just the progress bar, question, answers,
              and action button.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/s/${student.accessCode}/vocabulary/drill?mode=${selectedMode}`}
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
              >
                Start focused session
              </Link>
              <Link
                href={`/s/${student.accessCode}`}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
              >
                Back to dashboard
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {(selectedMode === "learn_new_words" ? summary.newWordPoolCount === 0 : summary.readyDrillsCount === 0) ? (
        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Nothing Ready Yet
            </div>
            <p className="text-sm leading-6 text-slate-600">
              {selectedMode === "learn_new_words"
                ? "No fresh vocabulary items are ready yet. Capture or generate more words first, then come back for a first-pass learning session."
                : "The review queue is active, but no queue items have enough drill data yet to build a playable session."}
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
