"use client";

import Link from "next/link";
import type { VocabExerciseSession } from "@/services/vocabulary/session-builder";
import type { ExerciseResult } from "@/components/student/exercise-player";

function formatModeLabel(mode: VocabExerciseSession["mode"]) {
  return mode.replace(/_/g, " ");
}

function getAccuracyTone(accuracy: number) {
  if (accuracy >= 85) {
    return "Strong work. This session looked stable and confident.";
  }

  if (accuracy >= 65) {
    return "Solid progress. A few words still need another pass, but the session moved in the right direction.";
  }

  return "Good checkpoint. This run exposed the words that need the next layer of reinforcement.";
}

function uniqueWords(words: Array<string | null | undefined>) {
  return Array.from(new Set(words.map((word) => word?.trim()).filter(Boolean))) as string[];
}

export default function VocabularySessionResults({
  session,
  results,
  accessCode,
}: {
  session: VocabExerciseSession;
  results: ExerciseResult[];
  accessCode: string;
}) {
  const completedCount = results.length || session.metadata.actual_size;
  const correctResults = results.filter((result) => result.is_correct);
  const incorrectResults = results.filter((result) => !result.is_correct);
  const correctCount = correctResults.length;
  const incorrectCount = incorrectResults.length;
  const accuracy = completedCount > 0 ? Math.round((correctCount / completedCount) * 100) : 0;

  const weakWords = uniqueWords(incorrectResults.map((result) => result.target_word));
  const strengthenedWords = uniqueWords(correctResults.map((result) => result.target_word));
  const weakRecoveryWords = uniqueWords(
    session.metadata.sequence_debug
      .filter(
        (item) =>
          item.selection_rule === "weak_word_retry" ||
          item.queue_bucket === "recently_failed" ||
          item.queue_bucket === "weak_again"
      )
      .map((item) => item.target_word)
  );
  const newLessonWords = uniqueWords(
    session.metadata.sequence_debug
      .filter((item) => Boolean(item.source_lesson_id))
      .map((item) => item.target_word)
  );
  const retentionCheckWords = uniqueWords(
    session.metadata.sequence_debug
      .filter((item) => item.selection_rule === "retention_check")
      .map((item) => item.target_word)
  );

  return (
    <div className="space-y-5 rounded-[32px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-emerald-50/70 p-6 shadow-sm sm:p-7">
      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Session Complete
        </div>
        <h2 className="text-2xl font-semibold text-slate-950">Vocabulary session finished</h2>
        <p className="max-w-2xl text-sm leading-6 text-slate-600">
          {getAccuracyTone(accuracy)}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Mode
          </div>
          <div className="mt-2 text-lg font-semibold text-slate-950">
            {formatModeLabel(session.mode)}
          </div>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Completed
          </div>
          <div className="mt-2 text-lg font-semibold text-slate-950">{completedCount}</div>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Accuracy
          </div>
          <div className="mt-2 text-lg font-semibold text-slate-950">{accuracy}%</div>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Correct
          </div>
          <div className="mt-2 text-lg font-semibold text-emerald-700">{correctCount}</div>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Incorrect
          </div>
          <div className="mt-2 text-lg font-semibold text-amber-700">{incorrectCount}</div>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Unique Words
          </div>
          <div className="mt-2 text-lg font-semibold text-slate-950">
            {session.metadata.unique_target_words || completedCount}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Session Takeaways
          </div>
          <div className="mt-4 space-y-4">
            <div>
              <div className="text-sm font-semibold text-slate-950">Words strengthened</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {strengthenedWords.length > 0 ? (
                  strengthenedWords.map((word) => (
                    <span
                      key={word}
                      className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800"
                    >
                      {word}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">No strengthened words recorded yet.</span>
                )}
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-950">Weak words from this session</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {weakWords.length > 0 ? (
                  weakWords.map((word) => (
                    <span
                      key={word}
                      className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"
                    >
                      {word}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">No weak words surfaced in this run.</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Session Mix
          </div>
          <div className="mt-4 space-y-4">
            <div>
              <div className="text-sm font-semibold text-slate-950">Weak-word recovery</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {weakRecoveryWords.length > 0 ? (
                  weakRecoveryWords.map((word) => (
                    <span
                      key={word}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
                    >
                      {word}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">No explicit weak-word recovery items this time.</span>
                )}
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-950">New lesson words</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {newLessonWords.length > 0 ? (
                  newLessonWords.map((word) => (
                    <span
                      key={word}
                      className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800"
                    >
                      {word}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">No lesson-first words were highlighted in this run.</span>
                )}
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-950">Retention checks</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {retentionCheckWords.length > 0 ? (
                  retentionCheckWords.map((word) => (
                    <span
                      key={word}
                      className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800"
                    >
                      {word}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">No retention-check words were identified in this session.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          What Next
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/s/${accessCode}/vocabulary?mode=review_weak_words`}
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Review weak words
          </Link>
          <Link
            href={`/s/${accessCode}/vocabulary?mode=mixed_practice`}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50"
          >
            Start another mixed practice session
          </Link>
          <Link
            href={`/s/${accessCode}`}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
          >
            Return to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
