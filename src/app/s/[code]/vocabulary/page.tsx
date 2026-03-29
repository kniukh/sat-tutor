import Link from "next/link";
import VocabularyAudioPrefetch from "@/components/student/VocabularyAudioPrefetch";
import PrepareVocabularyDrillsButton from "@/components/student/PrepareVocabularyDrillsButton";
import VocabSessionPlayer from "@/components/student/VocabSessionPlayer";
import VocabularySessionDevSummary from "@/components/student/VocabularySessionDevSummary";
import {
  getStudentVocabularyPageData,
  normalizeVocabularyPageMode,
  type VocabularyPageMode,
} from "@/services/vocabulary/vocabulary-page.service";

const MODE_OPTIONS: Array<{
  mode: VocabularyPageMode;
  label: string;
  description: string;
}> = [
  {
    mode: "learn_new_words",
    label: "Learn New Words",
    description: "Use a separate pool of unseen vocabulary before it enters the review cycle.",
  },
  {
    mode: "review_weak_words",
    label: "Review Weak Words",
    description: "Bias toward recently failed, weak-again, and urgent recovery words.",
  },
  {
    mode: "mixed_practice",
    label: "Mixed Practice",
    description: "Blend priority recovery with broader reinforcement across the queue.",
  },
];

function getModeHeading(mode: VocabularyPageMode) {
  return mode === "learn_new_words"
    ? "Learn New Words"
    : mode === "review_weak_words"
      ? "Weak Word Recovery"
      : "Mixed Practice Session";
}

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
    summary,
    adaptiveSelection,
    drillCounts,
    session,
    preparationNeeded,
  } = data;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <section className="overflow-hidden rounded-[36px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-900 text-white shadow-sm">
        <div className="space-y-6 p-6 sm:p-8">
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
              Vocabulary Studio
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Vocabulary Drills
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
              {student.fullName},{" "}
              {selectedMode === "learn_new_words"
                ? `this mode is introducing fresh vocabulary from a separate pool of ${summary.newWordPoolCount} ready new words.`
                : `your queue is sorted by real review pressure. The current mode is prioritizing ${
                    summary.topPriorityLabel?.toLowerCase() ?? "today's due words"
                  }.`}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                Active Queue
              </div>
              <div className="mt-2 text-3xl font-semibold">{summary.totalQueueItems}</div>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                Recently Failed
              </div>
              <div className="mt-2 text-3xl font-semibold">
                {summary.bucketCounts.recently_failed}
              </div>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                Weak Again
              </div>
              <div className="mt-2 text-3xl font-semibold">{summary.bucketCounts.weak_again}</div>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                Overdue
              </div>
              <div className="mt-2 text-3xl font-semibold">{summary.bucketCounts.overdue}</div>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                New Word Pool
              </div>
              <div className="mt-2 text-3xl font-semibold">{summary.newWordPoolCount}</div>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur-sm sm:col-span-2 xl:col-span-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                    Listen Match Readiness
                  </div>
                  <div className="mt-2 text-sm leading-6 text-white/75">
                    {summary.audioPreparation.listenReadyWordCount > 0
                      ? `${summary.audioPreparation.listenReadyWordCount} words already have audio ready for listen-based exercises.`
                      : "No audio-ready words are available yet, so the system is leaning on text and context drills first."}
                  </div>
                </div>
                <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/75">
                  {summary.audioPreparation.listenReadyWordCount} ready
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[26px] border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-white/80">Session readiness</div>
                  <div className="mt-1 text-xs text-white/60">
                    {selectedMode === "learn_new_words"
                      ? `${summary.newWordPoolCount} unseen items are available to turn into a first-pass learning run.`
                      : `${summary.readyDrillsCount} of ${summary.totalQueueItems} queue items are ready to play right now.`}
                  </div>
                </div>
                <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/75">
                  {selectedMode === "learn_new_words"
                    ? `${summary.newWordPoolCount} new`
                    : `${summary.readyPercent}% ready`}
                </div>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-white via-emerald-200 to-emerald-400 transition-[width] duration-300"
                  style={{
                    width: `${
                      selectedMode === "learn_new_words"
                        ? Math.min(100, summary.newWordPoolCount * 12)
                        : summary.readyPercent
                    }%`,
                  }}
                />
              </div>
            </div>

            <div className="rounded-[26px] border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <div className="text-sm font-medium text-white/80">Next words in rotation</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {summary.upcomingWords.length > 0 ? (
                  summary.upcomingWords.map((word) => (
                    <span
                      key={word}
                      className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80"
                    >
                      {word}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-white/60">No queued words yet.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {selectedMode === "learn_new_words" ? (
        <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Fresh Vocabulary
            </div>
            <h2 className="text-2xl font-semibold text-slate-950">Newest captured items</h2>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              This mode pulls from fresh vocabulary that is ready for a first-pass learning run,
              with a quick view into which recent lessons are feeding that pool.
            </p>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[26px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Newest Items
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {summary.learnNewWords.newestCapturedItems.length > 0 ? (
                  summary.learnNewWords.newestCapturedItems.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                    >
                      {item}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">No fresh captured items yet.</span>
                )}
              </div>
            </div>

            <div className="rounded-[26px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Recent Lessons
              </div>
              <div className="mt-3 space-y-3">
                {summary.learnNewWords.recentLessons.length > 0 ? (
                  summary.learnNewWords.recentLessons.map((lesson) => (
                    <div
                      key={lesson.lessonId}
                      className="flex items-center justify-between gap-3 rounded-[20px] border border-slate-200 bg-white px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {lesson.lessonName}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">Recent source lesson</div>
                      </div>
                      <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                        {lesson.readyNewWordCount} ready
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">
                    No recent lessons are feeding the fresh-word pool yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Session Mode
          </div>
          <h2 className="text-2xl font-semibold text-slate-950">Choose how to review</h2>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            Switch between a tighter recovery session and a more balanced practice run. The queue
            buckets stay the same; Learn New Words uses a separate fresh-word source pool.
          </p>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {MODE_OPTIONS.map((option) => {
            const isActive = option.mode === selectedMode;

            return (
              <Link
                key={option.mode}
                href={`/s/${student.accessCode}/vocabulary?mode=${option.mode}`}
                className={`rounded-[24px] border p-4 transition-all duration-200 ${
                  isActive
                    ? "border-slate-900 bg-slate-950 text-white shadow-[0_18px_35px_-24px_rgba(15,23,42,0.9)]"
                    : "border-slate-200 bg-slate-50 text-slate-900 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{option.label}</div>
                    <div
                      className={`mt-2 text-sm leading-6 ${
                        isActive ? "text-white/75" : "text-slate-600"
                      }`}
                    >
                      {option.description}
                    </div>
                  </div>
                  <div
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                      isActive
                        ? "border border-white/15 bg-white/10 text-white/80"
                        : "border border-slate-200 bg-white text-slate-500"
                    }`}
                  >
                    {isActive ? "Active" : "Switch"}
                  </div>
                </div>
              </Link>
            );
          })}
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
        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Prep Needed
            </div>
            <h2 className="text-2xl font-semibold text-slate-950">Prepare more drills</h2>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              {selectedMode === "learn_new_words"
                ? "Some captured vocabulary is fresh, but it still needs answer choices before it can become a clean first-pass learning session."
                : "The queue already knows what matters most, but some queued words still need answer choices before they can join the session."}
            </p>
          </div>
          <div className="mt-5">
            <PrepareVocabularyDrillsButton studentId={student.id} />
          </div>
        </section>
      ) : null}

      {session ? (
        <section className="space-y-4 rounded-[32px] border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 shadow-sm sm:p-5">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Live Practice
                </div>
                <h2 className="text-2xl font-semibold text-slate-950">
                  {getModeHeading(selectedMode)}
                </h2>
                <p className="max-w-2xl text-sm leading-6 text-slate-600">
                  {selectedMode === "learn_new_words"
                    ? `This run draws from fresh vocabulary that has not entered active review yet, then eases into context and retention.`
                    : `This run is weighted toward ${
                        summary.topPriorityLabel?.toLowerCase() ?? "today's review queue"
                      } and is currently composed mostly from ${
                        session.metadata.dominant_bucket
                          ? session.metadata.dominant_bucket.replace(/_/g, " ")
                          : "mixed review"
                      } items.`}
                </p>
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                {selectedMode}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Exercises
                </div>
                <div className="mt-2 text-xl font-semibold text-slate-950">
                  {session.metadata.actual_size}
                </div>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {selectedMode === "learn_new_words" ? "Source Pool" : "Dominant Bucket"}
                </div>
                <div className="mt-2 text-xl font-semibold text-slate-950">
                  {selectedMode === "learn_new_words"
                    ? "new vocabulary"
                    : session.metadata.dominant_bucket
                      ? session.metadata.dominant_bucket.replace(/_/g, " ")
                      : "mixed"}
                </div>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Word Drills
                </div>
                <div className="mt-2 text-xl font-semibold text-slate-950">{drillCounts.words}</div>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Phrase / Cloze
                </div>
                <div className="mt-2 text-xl font-semibold text-slate-950">
                  {drillCounts.phrases + drillCounts.cloze}
                </div>
              </div>
            </div>

            <VocabularySessionDevSummary
              session={session}
              adaptiveSelection={adaptiveSelection}
            />
          </div>

          <VocabSessionPlayer session={session} studentId={student.id} />
        </section>
      ) : null}

      {(selectedMode === "learn_new_words" ? summary.newWordPoolCount === 0 : summary.readyDrillsCount === 0) ? (
        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Nothing Ready Yet
            </div>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
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
