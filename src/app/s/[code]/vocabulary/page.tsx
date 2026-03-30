import Link from "next/link";
import VocabSessionPlayer from "@/components/student/VocabSessionPlayer";
import VocabularyAudioPrefetch from "@/components/student/VocabularyAudioPrefetch";
import {
  getStudentVocabularyPageData,
  normalizeVocabularyPageMode,
  normalizeVocabularySessionPhase,
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
  searchParams: Promise<{ mode?: string; phase?: string }>;
}) {
  const [{ code }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const selectedMode = normalizeVocabularyPageMode(resolvedSearchParams.mode);
  const selectedPhase = normalizeVocabularySessionPhase(resolvedSearchParams.phase);
  const data = await getStudentVocabularyPageData(code, selectedMode, selectedPhase);

  const {
    student,
    dashboard,
    summary,
    session,
    preparationNeeded,
  } = data;

  const topMetrics = [
    {
      label: "Captured",
      value: dashboard.totals.totalTrackedWords,
      hint: "Lifetime words in practice",
    },
    {
      label: "Mastered",
      value: dashboard.totals.masteredWords,
      hint: "Stable long-term words",
    },
    {
      label: "Practiced today",
      value: dashboard.totals.practicedTodayWords,
      hint: "Words touched in today's sessions",
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
            <h1 className="text-2xl font-semibold text-slate-950">Practice anytime</h1>
            <p className="text-sm leading-6 text-slate-600">
              {selectedMode === "learn_new_words"
                ? `${summary.newWordPoolCount} fresh words are ready, and the studio can keep going with adaptive review after that.`
                : summary.activePhase === "priority_review"
                  ? `${summary.priorityReadyCount} words are ready to practice first, then the session can continue with an adaptive mix instead of stopping at an internal due line.`
                  : `${summary.continuationReadyCount} words are ready now for endless adaptive continuation with weak-word reinforcement, recent lesson carryover, and light retention checks.`}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {topMetrics.map((item) => (
              <div key={item.label} className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {item.label}
                </div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">{item.value}</div>
                <div className="mt-1 text-sm text-slate-500">{item.hint}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800">
              {summary.activePhase === "endless_continuation"
                ? `${summary.continuationReadyCount} words ready now`
                : `${summary.priorityReadyCount} words ready now`}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
              {dashboard.totals.weakWords} weak words to revisit
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
              streak {dashboard.streak.current}
            </span>
            {summary.dueNowCount > 0 ? (
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-500">
                priority review active
              </span>
            ) : null}
            {summary.activePhaseLabel ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800">
                {summary.activePhaseLabel}
              </span>
            ) : null}
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
              Ready To Practice
            </div>
            <h2 className="text-2xl font-semibold text-slate-950">Focused drill session</h2>
            <p className="text-sm leading-6 text-slate-600">
              Launch a clean, full-screen run that starts with the most useful words first and keeps
              continuation ready, so practice can flow from priority review into open-ended repetition.
              You can also keep practicing прямо на этой странице.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/s/${student.accessCode}/vocabulary/drill?mode=${selectedMode}${
                  summary.activePhase ? `&phase=${summary.activePhase}` : ""
                }`}
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
              >
                {selectedMode === "review_weak_words"
                  ? "Review Weak Words"
                  : summary.activePhase === "endless_continuation"
                    ? "Continue Practice"
                    : "Start Practice"}
              </Link>
              {summary.canContinueEndlessly && summary.activePhase !== "endless_continuation" ? (
                <Link
                  href={`/s/${student.accessCode}/vocabulary/drill?mode=${selectedMode}&phase=endless_continuation`}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50"
                >
                  Continue Practice
                </Link>
              ) : null}
              {selectedMode !== "review_weak_words" ? (
                <Link
                  href={`/s/${student.accessCode}/vocabulary?mode=review_weak_words&phase=endless_continuation`}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50"
                >
                  Review Weak Words
                </Link>
              ) : null}
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

      {session ? (
        <section className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <VocabSessionPlayer
            session={session}
            studentId={student.id}
            accessCode={student.accessCode}
          />
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
