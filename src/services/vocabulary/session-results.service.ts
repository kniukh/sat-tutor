import type { ExerciseResult } from "@/components/student/exercise-player";
import type { VocabExerciseSession } from "@/services/vocabulary/session-builder";

export type VocabularySessionProgressSignal = {
  exerciseId: string;
  targetWord: string | null;
  previousLifecycleState: string | null;
  nextLifecycleState: string | null;
  sameSessionCreditCapped: boolean;
};

export type VocabularySessionRewardBreakdown = {
  baseXp: number;
  accuracyBonusXp: number;
  dueReviewBonusXp: number;
  totalXp: number;
};

export type VocabularySessionRewardCredit = {
  xp: VocabularySessionRewardBreakdown;
  gamification: {
    xp: number;
    level: number;
    streakDays: number;
    longestStreakDays: number;
  } | null;
};

export type VocabularySessionResultsSummary = {
  sessionPhase: VocabExerciseSession["metadata"]["session_phase"];
  extendedPracticeMode: boolean;
  continuationAvailable: boolean;
  completedCount: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
  accuracyTone: string;
  completionTitle: string;
  completionSubtitle: string;
  continueLabel: string;
  wordsReviewedCount: number;
  weakWords: string[];
  strengthenedWords: string[];
  weakRecoveryWords: string[];
  newLessonWords: string[];
  retentionCheckWords: string[];
  weakWordsImproved: string[];
  overdueReviewsCleared: string[];
  advancedWords: string[];
  reward: VocabularySessionRewardBreakdown;
  streakMessage: string | null;
};

function uniqueWords(words: Array<string | null | undefined>) {
  return Array.from(new Set(words.map((word) => word?.trim()).filter(Boolean))) as string[];
}

function getAccuracyTone(accuracy: number) {
  if (accuracy >= 90) {
    return "Excellent work. This session looked sharp, stable, and ready for harder follow-ups.";
  }

  if (accuracy >= 75) {
    return "Strong progress. You cleared meaningful review work and kept the session moving forward.";
  }

  if (accuracy >= 60) {
    return "Solid checkpoint. The session surfaced the words that still need another layer of practice.";
  }

  return "Useful reset. This run showed exactly where supportive repetition should focus next.";
}

function getCompletionCopy(params: {
  session: VocabExerciseSession;
  accuracy: number;
}) {
  const { session } = params;

  if (session.metadata.session_phase === "priority_review") {
    return {
      title: "Priority review cleared.",
      subtitle:
        "The highest-priority words are done. You can roll straight into adaptive continuation without rebuilding your practice.",
      continueLabel: "Continue Practice",
    };
  }

  return {
    title: "Practice checkpoint.",
    subtitle:
      "You can keep going for another adaptive mix of weak words, learning reinforcement, and light retention checks.",
    continueLabel: "Keep Going",
  };
}

export function calculateVocabularySessionReward(params: {
  completedCount: number;
  accuracy: number;
  sessionMode: VocabExerciseSession["mode"];
}) {
  const baseXp = params.completedCount * 3;
  const accuracyBonusXp =
    params.accuracy >= 90 ? 8 : params.accuracy >= 80 ? 5 : params.accuracy >= 70 ? 3 : 0;
  const dueReviewBonusXp = params.sessionMode === "review_weak_words" ? 3 : 0;

  return {
    baseXp,
    accuracyBonusXp,
    dueReviewBonusXp,
    totalXp: baseXp + accuracyBonusXp + dueReviewBonusXp,
  } satisfies VocabularySessionRewardBreakdown;
}

function buildStreakMessage(
  rewardCredit: VocabularySessionRewardCredit | null | undefined
) {
  if (!rewardCredit?.gamification) {
    return null;
  }

  const { streakDays, longestStreakDays } = rewardCredit.gamification;

  if (streakDays <= 0) {
    return null;
  }

  if (streakDays >= longestStreakDays && streakDays > 1) {
    return `Streak alive for ${streakDays} days. You are matching your best run so far.`;
  }

  if (streakDays === 1) {
    return "Your streak is active today. Another session tomorrow keeps it growing.";
  }

  return `Streak alive for ${streakDays} days. Keep the rhythm going tomorrow.`;
}

export function buildVocabularySessionResultsSummary(params: {
  session: VocabExerciseSession;
  results: ExerciseResult[];
  progressSignals?: VocabularySessionProgressSignal[];
  rewardCredit?: VocabularySessionRewardCredit | null;
}) {
  const completedCount = params.results.length || params.session.metadata.actual_size;
  const correctResults = params.results.filter((result) => result.is_correct);
  const incorrectResults = params.results.filter((result) => !result.is_correct);
  const correctCount = correctResults.length;
  const incorrectCount = incorrectResults.length;
  const accuracy = completedCount > 0 ? Math.round((correctCount / completedCount) * 100) : 0;
  const wordsReviewedCount = uniqueWords(params.results.map((result) => result.target_word)).length;

  const weakWords = uniqueWords(incorrectResults.map((result) => result.target_word));
  const strengthenedWords = uniqueWords(correctResults.map((result) => result.target_word));
  const weakRecoveryWords = uniqueWords(
    params.session.metadata.sequence_debug
      .filter(
        (item) =>
          item.selection_rule === "weak_word_retry" ||
          item.queue_bucket === "recently_failed" ||
          item.queue_bucket === "weak_again"
      )
      .map((item) => item.target_word)
  );
  const newLessonWords = uniqueWords(
    params.session.metadata.sequence_debug
      .filter((item) => Boolean(item.source_lesson_id))
      .map((item) => item.target_word)
  );
  const retentionCheckWords = uniqueWords(
    params.session.metadata.sequence_debug
      .filter((item) => item.selection_rule === "retention_check")
      .map((item) => item.target_word)
  );
  const overdueReviewsCleared = uniqueWords(
    params.session.metadata.sequence_debug
      .filter((item) => item.queue_bucket === "overdue")
      .map((item) => item.target_word)
      .filter((word) => strengthenedWords.includes(word))
  );
  const weakWordsImproved = uniqueWords(
    weakRecoveryWords.filter((word) => strengthenedWords.includes(word))
  );
  const advancedWords = uniqueWords(
    (params.progressSignals ?? [])
      .filter(
        (signal) =>
          Boolean(signal.targetWord) &&
          !signal.sameSessionCreditCapped &&
          Boolean(signal.nextLifecycleState) &&
          signal.previousLifecycleState !== signal.nextLifecycleState
      )
      .map((signal) => signal.targetWord)
  );
  const completionCopy = getCompletionCopy({
    session: params.session,
    accuracy,
  });

  return {
    sessionPhase: params.session.metadata.session_phase,
    extendedPracticeMode: params.session.metadata.extended_practice_mode,
    continuationAvailable: params.session.metadata.continuation_available,
    completedCount,
    correctCount,
    incorrectCount,
    accuracy,
    accuracyTone: getAccuracyTone(accuracy),
    completionTitle: completionCopy.title,
    completionSubtitle: completionCopy.subtitle,
    continueLabel: completionCopy.continueLabel,
    wordsReviewedCount,
    weakWords,
    strengthenedWords,
    weakRecoveryWords,
    newLessonWords,
    retentionCheckWords,
    weakWordsImproved,
    overdueReviewsCleared,
    advancedWords,
    reward:
      params.rewardCredit?.xp ??
      calculateVocabularySessionReward({
        completedCount,
        accuracy,
        sessionMode: params.session.mode,
      }),
    streakMessage: buildStreakMessage(params.rewardCredit),
  } satisfies VocabularySessionResultsSummary;
}
