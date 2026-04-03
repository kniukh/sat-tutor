"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import MascotCat from "@/components/student/MascotCat";
import FeedbackSettingsButton from "@/components/student/FeedbackSettingsButton";
import {
  studentMistakeBrainPath,
  studentVocabularyDrillPath,
  studentVocabularyPath,
} from "@/lib/routes/student";
import type { VocabExerciseSession } from "@/services/vocabulary/session-builder";
import type { ExerciseResult } from "@/components/student/exercise-player";
import {
  buildVocabularySessionResultsSummary,
  type VocabularySessionGamificationSummary,
  type VocabularySessionProgressSignal,
  type VocabularySessionRewardCredit,
} from "@/services/vocabulary/session-results.service";
import { triggerFeedbackCue } from "@/services/feedback/feedback-effects.client";
import { useFeedbackSettings } from "@/services/feedback/use-feedback-settings";

export default function VocabularySessionResults({
  session,
  results,
  accessCode,
  progressSignals,
  rewardCredit,
  sessionGamification,
  isRewardPending = false,
  focused = false,
}: {
  session: VocabExerciseSession;
  results: ExerciseResult[];
  accessCode: string;
  progressSignals?: VocabularySessionProgressSignal[];
  rewardCredit?: VocabularySessionRewardCredit | null;
  sessionGamification?: VocabularySessionGamificationSummary | null;
  isRewardPending?: boolean;
  focused?: boolean;
}) {
  const completionPlayedRef = useRef(false);
  const { settings: feedbackSettings } = useFeedbackSettings();
  const summary = buildVocabularySessionResultsSummary({
    session,
    results,
    progressSignals,
    rewardCredit,
    sessionGamification,
  });
  const continueHref = studentVocabularyDrillPath({
    mode: session.mode,
    phase: "endless_continuation",
  });
  const weakWordsHref = studentVocabularyPath({
    mode: "review_weak_words",
    phase: "endless_continuation",
  });
  const insightsHref = studentMistakeBrainPath();

  useEffect(() => {
    if (completionPlayedRef.current) {
      return;
    }

    completionPlayedRef.current = true;
    triggerFeedbackCue("completion", feedbackSettings);
  }, [feedbackSettings]);

  const sessionHighlights = [
    {
      label: "XP",
      value: `+${summary.sessionGamification?.totalXpEarned ?? summary.reward.totalXp}`,
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
      label: "Max combo",
      value:
        summary.sessionGamification && summary.sessionGamification.maxCombo > 0
          ? `x${summary.sessionGamification.maxCombo}`
          : "x0",
      hint: "Best run this session",
    },
    {
      label: "Words improved",
      value: String(summary.sessionGamification?.wordsImprovedCount ?? summary.advancedWords.length),
      hint: "Moved forward today",
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

  if (focused) {
    return (
      <div className="mx-auto flex min-h-[100svh] w-full max-w-xl flex-col justify-center gap-6 px-4 py-6 text-center sm:px-6">
        <div className="space-y-3">
          <div className="flex justify-center">
            <MascotCat mood="celebrate" size="md" />
          </div>
          <div className="app-kicker">
            {summary.sessionPhase === "priority_review" ? "Checkpoint" : "Practice Checkpoint"}
          </div>
          <h2 className="app-heading-lg text-[2rem]">{summary.completionTitle}</h2>
          <p className="token-text-secondary text-base leading-7">{summary.completionSubtitle}</p>
          <p className="app-copy font-medium">{summary.rewardNote}</p>
          {summary.sessionGamification?.leveledUp ? (
            <div className="rounded-full border border-[var(--color-secondary)] bg-[var(--color-secondary-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-secondary)]">
              {`Level ${summary.sessionGamification.currentLevel ?? 1} reached`}
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="app-card-soft p-4">
            <div className="app-kicker token-text-muted">
              Accuracy
            </div>
            <div className="token-text-primary mt-2 text-3xl font-semibold">{summary.accuracy}%</div>
          </div>
          <div className="app-card-soft p-4">
            <div className="app-kicker token-text-muted">
              XP
            </div>
            <div className="token-text-primary mt-2 text-3xl font-semibold">
              +{summary.sessionGamification?.totalXpEarned ?? summary.reward.totalXp}
            </div>
          </div>
        </div>

        {summary.sessionGamification ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="app-card-soft p-4">
              <div className="app-kicker token-text-muted">Max combo</div>
              <div className="token-text-primary mt-2 text-3xl font-semibold">
                {summary.sessionGamification.maxCombo > 0 ? `x${summary.sessionGamification.maxCombo}` : "x0"}
              </div>
            </div>
            <div className="app-card-soft p-4">
              <div className="app-kicker token-text-muted">Words improved</div>
              <div className="token-text-primary mt-2 text-3xl font-semibold">
                {summary.sessionGamification.wordsImprovedCount}
              </div>
            </div>
          </div>
        ) : null}

        {summary.sessionGamification?.leveledUp ? (
          <div className="rounded-[1.5rem] border border-[var(--color-secondary)] bg-[var(--color-secondary-soft)] px-4 py-4 text-left">
            <div className="token-text-primary text-sm font-semibold">Level up</div>
            <div className="token-text-secondary mt-1 text-sm leading-6">
              You moved from level {summary.sessionGamification.previousLevel ?? 1} to level{" "}
              {summary.sessionGamification.currentLevel ?? 1}.
            </div>
          </div>
        ) : null}

        <div className="space-y-3 pt-2">
          <Link
            href={continueHref}
            className="app-button app-button-primary flex w-full"
          >
            {summary.continueLabel}
          </Link>
          <Link
            href={weakWordsHref}
            className="app-button app-button-secondary flex w-full"
          >
            Review Weak Words
          </Link>
          <Link
            href={studentVocabularyPath({ mode: session.mode })}
            className="app-button app-button-muted flex w-full"
          >
            Back to vocabulary
          </Link>
          <Link
            href={insightsHref}
            className="text-sm font-semibold text-slate-600 underline underline-offset-4"
          >
            View your weak areas
          </Link>
          <div className="flex justify-center">
            <FeedbackSettingsButton label="Feedback settings" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-card mx-auto max-w-3xl space-y-5 p-5 sm:p-6">
      <div className="space-y-3 text-center sm:text-left">
        <div className="flex justify-center sm:justify-start">
          <MascotCat mood="celebrate" size="md" />
        </div>
        <div className="app-kicker">
          {summary.sessionPhase === "priority_review" ? "Checkpoint" : "Practice Checkpoint"}
        </div>
        <h2 className="app-heading-lg">{summary.completionTitle}</h2>
        <p className="app-copy">
          {summary.completionSubtitle} {summary.accuracyTone}
        </p>
        <p className="app-copy font-medium">{summary.rewardNote}</p>
        {summary.sessionGamification?.leveledUp ? (
          <div className="rounded-full border border-[var(--color-secondary)] bg-[var(--color-secondary-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-secondary)]">
            {`Level ${summary.sessionGamification.currentLevel ?? 1} reached`}
          </div>
        ) : null}
        <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
          <span className="surface-soft-panel token-text-secondary rounded-full px-3 py-1 text-xs font-semibold">
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
          <div key={item.label} className="surface-soft-panel rounded-[22px] p-4">
            <div className="token-text-muted text-xs font-semibold uppercase tracking-[0.16em]">
              {item.label}
            </div>
            <div className="token-text-primary mt-2 text-xl font-semibold">{item.value}</div>
            <div className="token-text-muted mt-1 text-sm">{item.hint}</div>
          </div>
        ))}
      </div>

      <div className="surface-soft-panel rounded-[24px] p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="surface-panel rounded-[20px] p-4">
            <div className="token-text-muted text-xs font-semibold uppercase tracking-[0.16em]">
              Weak words improved
            </div>
            <div className="token-text-primary mt-2 text-2xl font-semibold">
              {summary.weakWordsImproved.length}
            </div>
          </div>
          <div className="surface-panel rounded-[20px] p-4">
            <div className="token-text-muted text-xs font-semibold uppercase tracking-[0.16em]">
              Lifecycle moves
            </div>
            <div className="token-text-primary mt-2 text-2xl font-semibold">
              {summary.sessionGamification?.wordsImprovedCount ?? summary.advancedWords.length}
            </div>
          </div>
          <div className="surface-panel rounded-[20px] p-4">
            <div className="token-text-muted text-xs font-semibold uppercase tracking-[0.16em]">
              Overdue cleared
            </div>
            <div className="token-text-primary mt-2 text-2xl font-semibold">
              {summary.overdueReviewsCleared.length}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {progressItems.map((item) => (
          <div key={item.label} className="surface-soft-panel rounded-[24px] p-4">
            <div className="token-text-primary text-sm font-semibold">{item.label}</div>
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
                <span className="token-text-muted text-sm">{item.empty}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {sessionTags.length > 0 ? (
        <div className="surface-soft-panel rounded-[24px] p-4">
          <div className="token-text-primary text-sm font-semibold">This session focused on</div>
          <div className="mt-4 space-y-4">
            {sessionTags.map((group) => (
              <div key={group.label}>
                <div className="token-text-muted text-xs font-semibold uppercase tracking-[0.16em]">
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

      <div className="surface-soft-panel space-y-3 rounded-[24px] p-4">
        <div>
          <div className="token-text-muted text-[11px] font-semibold uppercase tracking-[0.18em]">
            What Next
          </div>
          <div className="token-text-secondary mt-1 text-sm">
            {isRewardPending
              ? "Saving your session credit..."
              : "Keep the momentum going with another adaptive checkpoint instead of stopping after today's priority words."}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={continueHref}
            className="app-button app-button-primary"
          >
            {summary.continueLabel}
          </Link>
          <Link
            href={weakWordsHref}
            className="app-button app-button-secondary"
          >
            Review weak words
          </Link>
          <Link
            href={studentVocabularyPath({ mode: session.mode })}
            className="app-button app-button-muted"
          >
            Back to vocabulary
          </Link>
        </div>
        <div>
          <Link
            href={insightsHref}
            className="hero-link text-sm font-semibold underline underline-offset-4"
          >
            View your weak areas
          </Link>
        </div>
        <div>
          <FeedbackSettingsButton label="Feedback settings" />
        </div>
      </div>
    </div>
  );
}
