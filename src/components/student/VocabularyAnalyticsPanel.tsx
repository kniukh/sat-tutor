import type { StudentVocabularyAnalytics } from "@/services/analytics/vocabulary-analytics.service";

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

export default function VocabularyAnalyticsPanel({
  analytics,
}: {
  analytics: StudentVocabularyAnalytics;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-slate-500">Vocab exercises completed</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {analytics.summary.totalExercisesCompleted}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-slate-500">Vocabulary accuracy</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {formatPercent(analytics.summary.overallAccuracy)}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-slate-500">Recent sessions</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {analytics.summary.recentSessionCount7d}
          </div>
          <div className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">
            last 7 days
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-slate-500">Avg. response time</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {formatDuration(analytics.summary.averageResponseTimeMs)}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-xl font-semibold text-slate-900">Accuracy by exercise type</h2>
          <div className="mt-4 space-y-3">
            {analytics.accuracyByExerciseType.length === 0 ? (
              <p className="text-slate-600">No vocabulary attempts yet.</p>
            ) : (
              analytics.accuracyByExerciseType.map((item) => (
                <div
                  key={item.key}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-900">
                      {item.key.replace(/_/g, " ")}
                    </div>
                    <div className="text-sm font-medium text-slate-600">
                      {formatPercent(item.accuracy)}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    {item.correct} correct out of {item.attempts}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-xl font-semibold text-slate-900">Accuracy by modality</h2>
          <div className="mt-4 space-y-3">
            {analytics.accuracyByModality.length === 0 ? (
              <p className="text-slate-600">No modality data yet.</p>
            ) : (
              analytics.accuracyByModality.map((item) => (
                <div
                  key={item.key}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold capitalize text-slate-900">{item.key}</div>
                    <div className="text-sm font-medium text-slate-600">
                      {formatPercent(item.accuracy)}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    {item.correct} correct out of {item.attempts}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-xl font-semibold text-slate-900">Recent weak words</h2>
          <div className="mt-4 space-y-3">
            {analytics.recentWeakWords.length === 0 ? (
              <p className="text-slate-600">No weak words surfaced yet.</p>
            ) : (
              analytics.recentWeakWords.map((item) => (
                <div key={`${item.wordId ?? item.word}`} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-900">{item.word}</div>
                    <div className="text-sm font-medium capitalize text-slate-600">
                      {item.lifecycleState.replace(/_/g, " ")}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    Mastery {formatPercent(item.masteryScore)} · Incorrect streak {item.consecutiveIncorrect}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-xl font-semibold text-slate-900">Most frequently missed words</h2>
          <div className="mt-4 space-y-3">
            {analytics.mostMissedWords.length === 0 ? (
              <p className="text-slate-600">No recurring misses yet.</p>
            ) : (
              analytics.mostMissedWords.map((item) => (
                <div key={`${item.wordId ?? item.word}`} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-900">{item.word}</div>
                    <div className="text-sm font-medium text-slate-600">
                      {item.wrongCount} misses
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    Accuracy {formatPercent(item.accuracy)} across {item.totalAttempts} attempts
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-xl font-semibold text-slate-900">Mastery distribution</h2>
          <div className="mt-4 space-y-3">
            {analytics.masteryDistribution.length === 0 ? (
              <p className="text-slate-600">No word progress data yet.</p>
            ) : (
              analytics.masteryDistribution.map((item) => (
                <div key={item.lifecycleState} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-900">
                      {item.lifecycleState.replace(/_/g, " ")}
                    </div>
                    <div className="text-sm font-medium text-slate-600">{item.count} words</div>
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    Avg. mastery {formatPercent(item.averageMasteryScore)}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-xl font-semibold text-slate-900">Words improved in the last 7 days</h2>
          <div className="mt-4 space-y-3">
            {analytics.improvedWords7d.length === 0 ? (
              <p className="text-slate-600">No clear improvement patterns detected yet.</p>
            ) : (
              analytics.improvedWords7d.map((item) => (
                <div key={`${item.wordId ?? item.word}`} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-900">{item.word}</div>
                    <div className="text-sm font-medium text-emerald-700">
                      {formatPercent(item.recentAccuracy)}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-slate-600">{item.improvementReason}</div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="text-xl font-semibold text-slate-900">Recent vocabulary sessions</h2>
        <div className="mt-4 space-y-3">
          {analytics.recentSessions.length === 0 ? (
            <p className="text-slate-600">No vocabulary sessions recorded yet.</p>
          ) : (
            analytics.recentSessions.map((session) => (
              <div key={session.sessionId} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">
                      {session.exerciseCount} exercises · {session.distinctWords} words
                    </div>
                    <div className="text-sm text-slate-500">
                      {new Date(session.lastActivityAt).toLocaleString()}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-semibold text-slate-900">
                      {formatPercent(session.accuracy)}
                    </div>
                    <div className="text-sm text-slate-600">
                      {session.modalities.join(", ") || "mixed"}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
