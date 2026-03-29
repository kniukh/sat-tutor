"use client";

import Link from "next/link";
import type { VocabExerciseSession } from "@/services/vocabulary/session-builder";
import type { ExerciseResult } from "@/components/student/exercise-player";
import {
  buildVocabularySessionResultsSummary,
  type VocabularySessionProgressSignal,
  type VocabularySessionRewardCredit,
} from "@/services/vocabulary/session-results.service";

function formatModeLabel(mode: VocabExerciseSession["mode"]) {
  return mode.replace(/_/g, " ");
}

export default function VocabularySessionResults({
  session,
  results,
  accessCode,
  progressSignals,
  rewardCredit,
  isRewardPending = false,
}: {
  session: VocabExerciseSession;
  results: ExerciseResult[];
  accessCode: string;
  progressSignals?: VocabularySessionProgressSignal[];
  rewardCredit?: VocabularySessionRewardCredit | null;
  isRewardPending?: boolean;
}) {
  const summary = buildVocabularySessionResultsSummary({
    session,
    results,
    progressSignals,
    rewardCredit,
  });

  const sessionHighlights = [
    {
      label: "XP",
      value: `+${summary.reward.totalXp}`,
      hint:
        summary.reward.accuracyBonusXp > 0 || summary.reward.dueReviewBonusXp > 0
          ? "Includes session bonuses"
          : "Base session credit",
    },
    {
      label: "Correct",
      value: String(summary.correctCount),
      hint: `${summary.incorrectCount} missed`,
    },
    {
      label: "Words reviewed",
      value: String(summary.wordsReviewedCount),
      hint: "Unique words touched",
    },
    {
      label: "Mode",
      value: formatModeLabel(session.mode),
      hint: "Current session path",
    },
  ];

  const progressItems = [
    {
      label: "Words strengthened",
      words: summary.strengthenedWords,
      empty: "No strengthened words recorded yet.",
      tone: "emerald",
    },
    {
      label: "Needs more review",
      words: summary.weakWords,
      empty: "No weak words surfaced in this run.",
      tone: "amber",
    },
  ] as const;

  const sessionTags = [
    {
      label: "Weak-word recovery",
      words: summary.weakRecoveryWords,
      tone: "slate",
    },
    {
      label: "New lesson words",
      words: summary.newLessonWords,
      tone: "sky",
    },
    {
      label: "Retention checks",
      words: summary.retentionCheckWords,
      tone: "violet",
    },
  ].filter((item) => item.words.length > 0);

  const toneClasses = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    sky: "border-sky-200 bg-sky-50 text-sky-800",
    violet: "border-violet-200 bg-violet-50 text-violet-800",
    slate: "border-slate-200 bg-slate-100 text-slate-700",
  } as const;

  return (
    <div className="mx-auto max-w-3xl space-y-5 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="space-y-3 text-center sm:text-left">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Session Complete
        </div>
        <h2 className="text-2xl font-semibold text-slate-950">Nice work. Session finished.</h2>
        <p className="text-sm leading-6 text-slate-600">{summary.accuracyTone}</p>
        <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
            {summary.completedCount} exercises
          </span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            {summary.accuracy}% accuracy
          </span>
          {summary.streakMessage ? (
            <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
              {summary.streakMessage}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {sessionHighlights.map((item) => (
          <div key={item.label} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {item.label}
            </div>
            <div className="mt-2 text-xl font-semibold text-slate-950">{item.value}</div>
            <div className="mt-1 text-sm text-slate-500">{item.hint}</div>
          </div>
        ))}
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[20px] border border-slate-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Weak words improved
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">
              {summary.weakWordsImproved.length}
            </div>
          </div>
          <div className="rounded-[20px] border border-slate-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Lifecycle moves
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">
              {summary.advancedWords.length}
            </div>
          </div>
          <div className="rounded-[20px] border border-slate-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Overdue cleared
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">
              {summary.overdueReviewsCleared.length}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {progressItems.map((item) => (
          <div key={item.label} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-950">{item.label}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.words.length > 0 ? (
                item.words.map((word) => (
                  <span
                    key={word}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      toneClasses[item.tone]
                    }`}
                  >
                    {word}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500">{item.empty}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {sessionTags.length > 0 ? (
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-950">This session focused on</div>
          <div className="mt-4 space-y-4">
            {sessionTags.map((group) => (
              <div key={group.label}>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {group.label}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {group.words.map((word) => (
                    <span
                      key={word}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        toneClasses[group.tone]
                      }`}
                    >
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            What Next
          </div>
          <div className="mt-1 text-sm text-slate-600">
            {isRewardPending
              ? "Saving your session credit..."
              : "Keep the momentum going with the next focused session."}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
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
