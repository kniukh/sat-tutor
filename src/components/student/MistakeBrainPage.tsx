import Link from "next/link";
import type { MistakeBrainPageData } from "@/services/analytics/mistake-brain-page.service";

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatDuration(value: number | null) {
  if (!value) {
    return "No timing yet";
  }

  if (value < 1000) {
    return `${value} ms`;
  }

  return `${(value / 1000).toFixed(1)}s`;
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ");
}

function getProgressFillStyle(accuracy: number) {
  if (accuracy < 0.55) {
    return { width: `${accuracy * 100}%`, background: "var(--color-error)" };
  }

  if (accuracy < 0.75) {
    return { width: `${accuracy * 100}%`, background: "var(--color-secondary)" };
  }

  return { width: `${accuracy * 100}%`, background: "var(--color-success)" };
}

export default function MistakeBrainPage({
  data,
}: {
  data: MistakeBrainPageData;
}) {
  const weakWords = data.reviewLists.weakWords.slice(0, 4);
  const learningWords = data.reviewLists.learningWords.slice(0, 4);
  const recentlyMissed = data.reviewLists.recentlyMissed.slice(0, 4);
  const weakSkills = data.weakSkills.slice(0, 6);
  const modalityPerformance = data.deeperStats.modalityPerformance.slice(0, 4);
  const exerciseTypePerformance = data.deeperStats.exerciseTypePerformance.slice(0, 5);

  return (
    <div className="content-shell max-w-6xl space-y-5">
      <section className="app-hero-panel p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="app-kicker text-white/70">Mistake Brain</div>
            <h1 className="text-[1.9rem] font-semibold leading-[1.04] tracking-[-0.03em] text-white sm:text-[2.4rem]">
              Know what is weak and what to do next.
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-white/72">
              Weak skills, review lists, and deeper learning stats in one place.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/s/${data.student.accessCode}/vocabulary/drill?mode=review_weak_words&phase=endless_continuation`}
              className="primary-button bg-white text-slate-950 hover:bg-slate-100"
            >
              Review Weak Words
            </Link>
            <Link href={`/s/${data.student.accessCode}`} className="secondary-button bg-white/90">
              Back to Dashboard
            </Link>
            <Link href={`/s/${data.student.accessCode}/progress`} className="secondary-button bg-white/90">
              Open Progress
            </Link>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[1.35rem] bg-white/10 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
              Total Attempts
            </div>
            <div className="mt-2 text-3xl font-semibold text-white">{data.overview.totalAttempts}</div>
          </div>

          <div className="rounded-[1.35rem] bg-white/10 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
              Accuracy
            </div>
            <div className="mt-2 text-3xl font-semibold text-white">
              {formatPercent(data.overview.accuracy)}
            </div>
          </div>

          <div className="rounded-[1.35rem] bg-white/10 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
              Sessions Completed
            </div>
            <div className="mt-2 text-3xl font-semibold text-white">
              {data.overview.sessionsCompleted}
            </div>
          </div>

          <div className="rounded-[1.35rem] bg-white/10 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
              Avg. Response
            </div>
            <div className="mt-2 text-3xl font-semibold text-white">
              {formatDuration(data.overview.averageResponseTimeMs)}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <Link
            href={`/s/${data.student.accessCode}/vocabulary/drill?mode=review_weak_words&phase=endless_continuation`}
            className="primary-button h-auto justify-between rounded-[1.25rem] bg-white text-slate-950 hover:bg-slate-100 px-4 py-4 text-left"
          >
            <div className="space-y-1">
              <div>Review Weak Words</div>
              <div className="text-xs font-medium leading-5 text-slate-600">
                Turn weak items into fast corrective practice.
              </div>
            </div>
          </Link>
          {data.recommendations.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={`${item.variant === "primary" ? "primary-button bg-white text-slate-950 hover:bg-slate-100" : "secondary-button bg-white/90"} h-auto justify-between rounded-[1.25rem] px-4 py-4 text-left`}
            >
              <div className="space-y-1">
                <div>{item.label}</div>
                {item.description ? (
                  <div className="text-xs font-medium leading-5 text-slate-600">
                    {item.description}
                  </div>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="card-surface p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="app-kicker">Weak Skills</div>
            <h2 className="app-heading-md mt-1">Where performance drops first</h2>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {weakSkills.length === 0 ? (
            <div className="app-copy">No weak skill pattern is strong enough to call out yet.</div>
          ) : (
            weakSkills.map((item) => (
              <div key={item.skill} className="app-card-soft p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold capitalize text-slate-950">
                    {formatLabel(item.skill)}
                  </div>
                  <div className="text-sm font-semibold text-slate-700">
                    {formatPercent(item.accuracy)}
                  </div>
                </div>
                <div className="mt-3 progress-track">
                  <div className="progress-fill" style={getProgressFillStyle(item.accuracy)} />
                </div>
                <div className="mt-2 text-sm text-slate-500">
                  {item.correct} correct out of {item.attempts} attempts
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <div className="app-kicker">Review Lists</div>
          <h2 className="app-heading-md mt-1">What is worth practicing next</h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <div className="card-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="app-kicker">Weak Words</div>
              <h3 className="app-heading-md mt-1">Review first</h3>
            </div>
            <Link
              href={`/s/${data.student.accessCode}/vocabulary/drill?mode=review_weak_words&phase=endless_continuation`}
              className="secondary-button px-3 py-2 text-xs"
            >
              Review
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {weakWords.length === 0 ? (
              <div className="app-copy">No weak words surfaced yet.</div>
            ) : (
              weakWords.map((item) => (
                <div key={`${item.wordId ?? item.word}`} className="app-card-soft p-3.5">
                  <div className="font-semibold text-slate-950">{item.word}</div>
                  <div className="mt-1 text-sm text-slate-500 capitalize">
                    {formatLabel(item.lifecycleState)} · {formatPercent(item.masteryScore)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="app-kicker">Learning Words</div>
              <h3 className="app-heading-md mt-1">Still stabilizing</h3>
            </div>
            <Link
              href={`/s/${data.student.accessCode}/vocabulary/drill?mode=mixed_practice&phase=endless_continuation`}
              className="secondary-button px-3 py-2 text-xs"
            >
              Practice
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {learningWords.length === 0 ? (
              <div className="app-copy">No active learning queue right now.</div>
            ) : (
              learningWords.map((item) => (
                <div key={`${item.wordId ?? item.word}`} className="app-card-soft p-3.5">
                  <div className="font-semibold text-slate-950">{item.word}</div>
                  <div className="mt-1 text-sm text-slate-500 capitalize">
                    {formatLabel(item.lifecycleState)} · {formatPercent(item.masteryScore)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="app-kicker">Recently Missed</div>
              <h3 className="app-heading-md mt-1">Recurring friction</h3>
            </div>
            <Link
              href={`/s/${data.student.accessCode}/vocabulary/drill?mode=review_weak_words&phase=endless_continuation`}
              className="secondary-button px-3 py-2 text-xs"
            >
              Practice
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {recentlyMissed.length === 0 ? (
              <div className="app-copy">No recurring misses yet.</div>
            ) : (
              recentlyMissed.map((item) => (
                <div key={`${item.wordId ?? item.word}`} className="app-card-soft p-3.5">
                  <div className="font-semibold text-slate-950">{item.word}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {item.wrongCount} misses · {formatPercent(item.accuracy)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card-surface p-5">
          <div className="app-kicker">Mastered</div>
          <h3 className="app-heading-md mt-1">Stable vocabulary</h3>

          <div className="mt-4 space-y-3">
            <div className="app-card-soft p-4">
              <div className="text-3xl font-semibold text-slate-950">
                {data.reviewLists.masteredSummary.count}
              </div>
              <div className="mt-2 text-sm text-slate-600">
                Lifetime mastered words.
              </div>
            </div>

            <div className="app-card-soft p-4">
              <div className="app-kicker text-slate-500">Average Mastery</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">
                {formatPercent(data.reviewLists.masteredSummary.averageMasteryScore)}
              </div>
              <div className="mt-2 text-sm text-slate-600">
                Across words already in the mastered state.
              </div>
            </div>
          </div>
        </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="card-surface p-5 sm:p-6">
          <div className="app-kicker">Deeper Stats</div>
          <h2 className="app-heading-md mt-1">How learning is behaving</h2>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="app-card-soft p-4">
              <div className="app-kicker text-slate-500">Reading Attempts</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">
                {data.overview.readingAttempts}
              </div>
            </div>

            <div className="app-card-soft p-4">
              <div className="app-kicker text-slate-500">Vocab Attempts</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">
                {data.overview.vocabAttempts}
              </div>
            </div>

            <div className="app-card-soft p-4">
              <div className="app-kicker text-slate-500">Practiced Today</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">
                {data.deeperStats.practicedTodayWords}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="text-sm font-semibold text-slate-900">Modality performance</div>
              {modalityPerformance.length === 0 ? (
                <div className="app-copy">No modality data yet.</div>
              ) : (
                modalityPerformance.map((item) => (
                  <div key={item.key} className="app-card-soft p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium capitalize text-slate-900">{item.key}</div>
                      <div className="text-sm font-semibold text-slate-700">
                        {formatPercent(item.accuracy)}
                      </div>
                    </div>
                    <div className="mt-2 progress-track">
                      <div className="progress-fill" style={getProgressFillStyle(item.accuracy)} />
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold text-slate-900">Exercise type performance</div>
              {exerciseTypePerformance.length === 0 ? (
                <div className="app-copy">No drill-type data yet.</div>
              ) : (
                exerciseTypePerformance.map((item) => (
                  <div key={item.key} className="app-card-soft p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium capitalize text-slate-900">
                        {formatLabel(item.key)}
                      </div>
                      <div className="text-sm font-semibold text-slate-700">
                        {formatPercent(item.accuracy)}
                      </div>
                    </div>
                    <div className="mt-2 progress-track">
                      <div className="progress-fill" style={getProgressFillStyle(item.accuracy)} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="card-surface p-5 sm:p-6">
          <div className="app-kicker">Patterns</div>
          <h2 className="app-heading-md mt-1">What stands out</h2>

          <div className="mt-5 space-y-3">
            {data.patterns.length === 0 ? (
              <div className="app-card-soft p-4">
                <div className="font-semibold text-slate-900">Patterns will appear here</div>
                <div className="mt-2 text-sm leading-6 text-slate-600">
                  As more reading and vocabulary attempts accumulate, this section will surface repeatable weak spots.
                </div>
              </div>
            ) : (
              data.patterns.map((item) => (
                <div key={item.id} className="app-card-soft p-4">
                  <div className="font-semibold text-slate-900">{item.title}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</div>
                </div>
              ))
            )}

            <div className="app-card-soft p-4">
              <div className="app-kicker text-slate-500">Recent Sessions</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">
                {data.deeperStats.recentSessionCount7d}
              </div>
              <div className="mt-2 text-sm text-slate-600">
                Last 7 days · {data.deeperStats.recentSessionCount30d} in the last 30 days
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
