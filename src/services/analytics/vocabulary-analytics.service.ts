import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  ExerciseAttemptRow,
  VocabExerciseType,
  VocabModality,
  WordLifecycleState,
  WordProgressRow,
} from "@/types/vocab-tracking";

type AccuracyBreakdownItem<TKey extends string> = {
  key: TKey;
  attempts: number;
  correct: number;
  accuracy: number;
};

export type VocabularyWeakWordItem = {
  wordId: string | null;
  word: string;
  lifecycleState: WordLifecycleState;
  masteryScore: number;
  consecutiveIncorrect: number;
  consecutiveCorrect: number;
  lastSeenAt: string | null;
  nextReviewAt: string | null;
  sourceLessonId: string | null;
};

export type VocabularyMissedWordItem = {
  wordId: string | null;
  word: string;
  wrongCount: number;
  totalAttempts: number;
  accuracy: number;
  lastSeenAt: string | null;
};

export type VocabularyImprovedWordItem = {
  wordId: string | null;
  word: string;
  previousAccuracy: number | null;
  recentAccuracy: number;
  recentCorrectCount: number;
  recentAttemptCount: number;
  improvementReason: string;
};

export type VocabularyLifecycleDistributionItem = {
  lifecycleState: WordLifecycleState;
  count: number;
  averageMasteryScore: number;
};

export type VocabularyRecentSessionItem = {
  sessionId: string;
  exerciseCount: number;
  correctCount: number;
  accuracy: number;
  startedAt: string;
  lastActivityAt: string;
  distinctWords: number;
  modalities: VocabModality[];
};

export type StudentVocabularyAnalytics = {
  summary: {
    totalExercisesCompleted: number;
    overallAccuracy: number;
    averageResponseTimeMs: number | null;
    weakWordCount: number;
    recentSessionCount7d: number;
    recentSessionCount30d: number;
    wordsImproved7dCount: number;
  };
  accuracyByExerciseType: AccuracyBreakdownItem<VocabExerciseType>[];
  accuracyByModality: AccuracyBreakdownItem<VocabModality>[];
  recentWeakWords: VocabularyWeakWordItem[];
  masteryDistribution: VocabularyLifecycleDistributionItem[];
  recentSessions: VocabularyRecentSessionItem[];
  mostMissedWords: VocabularyMissedWordItem[];
  improvedWords7d: VocabularyImprovedWordItem[];
};

type AttemptAnalyticsRow = Pick<
  ExerciseAttemptRow,
  | "id"
  | "session_id"
  | "exercise_type"
  | "target_word_id"
  | "target_word"
  | "modality"
  | "is_correct"
  | "response_time_ms"
  | "created_at"
>;

type WordProgressAnalyticsRow = Pick<
  WordProgressRow,
  | "id"
  | "word"
  | "word_id"
  | "lifecycle_state"
  | "mastery_score"
  | "total_attempts"
  | "correct_attempts"
  | "last_seen_at"
  | "next_review_at"
  | "consecutive_incorrect"
  | "consecutive_correct"
  | "source_lesson_id"
>;

function toAccuracy(correct: number, attempts: number) {
  return attempts > 0 ? correct / attempts : 0;
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function summarizeAccuracyByKey<TKey extends string>(
  attempts: AttemptAnalyticsRow[],
  getKey: (attempt: AttemptAnalyticsRow) => TKey | null
) {
  const grouped = attempts.reduce<Map<TKey, { attempts: number; correct: number }>>(
    (accumulator, attempt) => {
      const key = getKey(attempt);
      if (!key) {
        return accumulator;
      }

      const existing = accumulator.get(key) ?? { attempts: 0, correct: 0 };
      existing.attempts += 1;
      if (attempt.is_correct) {
        existing.correct += 1;
      }
      accumulator.set(key, existing);
      return accumulator;
    },
    new Map()
  );

  return Array.from(grouped.entries())
    .map(([key, stats]) => ({
      key,
      attempts: stats.attempts,
      correct: stats.correct,
      accuracy: toAccuracy(stats.correct, stats.attempts),
    }))
    .sort((left, right) => {
      if (right.attempts !== left.attempts) {
        return right.attempts - left.attempts;
      }

      return left.accuracy - right.accuracy;
    });
}

function buildRecentSessions(attempts: AttemptAnalyticsRow[]) {
  const sessions = attempts.reduce<
    Map<
      string,
      {
        attempts: AttemptAnalyticsRow[];
        startedAt: string;
        lastActivityAt: string;
      }
    >
  >((accumulator, attempt) => {
    const existing = accumulator.get(attempt.session_id);

    if (existing) {
      existing.attempts.push(attempt);
      if (attempt.created_at < existing.startedAt) {
        existing.startedAt = attempt.created_at;
      }
      if (attempt.created_at > existing.lastActivityAt) {
        existing.lastActivityAt = attempt.created_at;
      }
      return accumulator;
    }

    accumulator.set(attempt.session_id, {
      attempts: [attempt],
      startedAt: attempt.created_at,
      lastActivityAt: attempt.created_at,
    });

    return accumulator;
  }, new Map());

  return Array.from(sessions.entries())
    .map(([sessionId, session]) => {
      const exerciseCount = session.attempts.length;
      const correctCount = session.attempts.filter((attempt) => attempt.is_correct).length;

      return {
        sessionId,
        exerciseCount,
        correctCount,
        accuracy: toAccuracy(correctCount, exerciseCount),
        startedAt: session.startedAt,
        lastActivityAt: session.lastActivityAt,
        distinctWords: new Set(
          session.attempts
            .map((attempt) => attempt.target_word_id ?? attempt.target_word ?? attempt.id)
            .filter(Boolean)
        ).size,
        modalities: Array.from(
          new Set(
            session.attempts
              .map((attempt) => attempt.modality)
              .filter((modality): modality is VocabModality => Boolean(modality))
          )
        ),
      };
    })
    .sort((left, right) => right.lastActivityAt.localeCompare(left.lastActivityAt));
}

function buildMostMissedWords(attempts: AttemptAnalyticsRow[]) {
  const grouped = attempts.reduce<
    Map<string, { wordId: string | null; word: string; total: number; wrong: number; lastSeenAt: string | null }>
  >((accumulator, attempt) => {
    const key = attempt.target_word_id ?? attempt.target_word ?? attempt.exercise_type;
    const existing = accumulator.get(key) ?? {
      wordId: attempt.target_word_id,
      word: attempt.target_word ?? "Unknown word",
      total: 0,
      wrong: 0,
      lastSeenAt: null,
    };
    existing.total += 1;
    if (!attempt.is_correct) {
      existing.wrong += 1;
    }
    if (!existing.lastSeenAt || attempt.created_at > existing.lastSeenAt) {
      existing.lastSeenAt = attempt.created_at;
    }
    accumulator.set(key, existing);
    return accumulator;
  }, new Map());

  return Array.from(grouped.values())
    .filter((item) => item.wrong > 0)
    .map((item) => ({
      wordId: item.wordId,
      word: item.word,
      wrongCount: item.wrong,
      totalAttempts: item.total,
      accuracy: toAccuracy(item.total - item.wrong, item.total),
      lastSeenAt: item.lastSeenAt,
    }))
    .sort((left, right) => {
      if (right.wrongCount !== left.wrongCount) {
        return right.wrongCount - left.wrongCount;
      }

      return left.accuracy - right.accuracy;
    })
    .slice(0, 8);
}

function buildImprovedWords(attempts: AttemptAnalyticsRow[], now: Date) {
  const sevenDaysAgo = now.getTime() - 1000 * 60 * 60 * 24 * 7;
  const grouped = attempts.reduce<Map<string, AttemptAnalyticsRow[]>>((accumulator, attempt) => {
    const key = attempt.target_word_id ?? attempt.target_word ?? attempt.exercise_type;
    const existing = accumulator.get(key) ?? [];
    existing.push(attempt);
    accumulator.set(key, existing);
    return accumulator;
  }, new Map());

  return Array.from(grouped.entries())
    .map(([key, wordAttempts]) => {
      const ordered = [...wordAttempts].sort((left, right) =>
        left.created_at.localeCompare(right.created_at)
      );
      const recentAttempts = ordered.filter(
        (attempt) => new Date(attempt.created_at).getTime() >= sevenDaysAgo
      );
      const previousAttempts = ordered.filter(
        (attempt) => new Date(attempt.created_at).getTime() < sevenDaysAgo
      );

      if (recentAttempts.length < 2) {
        return null;
      }

      const recentCorrectCount = recentAttempts.filter((attempt) => attempt.is_correct).length;
      const recentAccuracy = toAccuracy(recentCorrectCount, recentAttempts.length);
      const previousCorrectCount = previousAttempts.filter((attempt) => attempt.is_correct).length;
      const previousAccuracy =
        previousAttempts.length > 0
          ? toAccuracy(previousCorrectCount, previousAttempts.length)
          : null;
      const recoveredInsideWindow =
        recentAttempts.some((attempt) => !attempt.is_correct) &&
        recentAttempts[recentAttempts.length - 1]?.is_correct;

      if (
        recentAccuracy < 0.6 ||
        (!recoveredInsideWindow &&
          !(previousAccuracy !== null && recentAccuracy - previousAccuracy >= 0.2))
      ) {
        return null;
      }

      const latest = recentAttempts[recentAttempts.length - 1];
      const improvementReason =
        recoveredInsideWindow && previousAccuracy !== null
          ? "Recovered inside the last week after earlier misses."
          : previousAccuracy !== null
            ? "Recent accuracy improved compared with the earlier baseline."
            : "Built into a more stable recent pattern over the last week.";

      return {
        wordId: latest.target_word_id,
        word: latest.target_word ?? key,
        previousAccuracy,
        recentAccuracy,
        recentCorrectCount,
        recentAttemptCount: recentAttempts.length,
        improvementReason,
      } satisfies VocabularyImprovedWordItem;
    })
    .filter((item): item is VocabularyImprovedWordItem => Boolean(item))
    .sort((left, right) => right.recentAccuracy - left.recentAccuracy)
    .slice(0, 6);
}

function buildWeakWords(wordProgressRows: WordProgressAnalyticsRow[], limit?: number) {
  const weakWords = wordProgressRows
    .filter(
      (row) =>
        row.lifecycle_state === "weak_again" ||
        Number(row.consecutive_incorrect ?? 0) > 0 ||
        Number(row.mastery_score ?? 0) < 0.45
    )
    .map((row) => ({
      wordId: row.word_id,
      word: row.word,
      lifecycleState: row.lifecycle_state,
      masteryScore: Number(row.mastery_score ?? 0),
      consecutiveIncorrect: Number(row.consecutive_incorrect ?? 0),
      consecutiveCorrect: Number(row.consecutive_correct ?? 0),
      lastSeenAt: row.last_seen_at,
      nextReviewAt: row.next_review_at,
      sourceLessonId: row.source_lesson_id,
    }))
    .sort((left, right) => {
      if (right.consecutiveIncorrect !== left.consecutiveIncorrect) {
        return right.consecutiveIncorrect - left.consecutiveIncorrect;
      }

      return left.masteryScore - right.masteryScore;
    });

  return typeof limit === "number" ? weakWords.slice(0, limit) : weakWords;
}

function buildMasteryDistribution(wordProgressRows: WordProgressAnalyticsRow[]) {
  const lifecycleOrder: WordLifecycleState[] = [
    "new",
    "learning",
    "review",
    "mastered",
    "weak_again",
  ];

  const grouped = lifecycleOrder.map((lifecycleState) => {
    const rows = wordProgressRows.filter((row) => row.lifecycle_state === lifecycleState);
    const masteryValues = rows.map((row) => Number(row.mastery_score ?? 0));

    return {
      lifecycleState,
      count: rows.length,
      averageMasteryScore:
        masteryValues.length > 0
          ? masteryValues.reduce((sum, value) => sum + value, 0) / masteryValues.length
          : 0,
    } satisfies VocabularyLifecycleDistributionItem;
  });

  return grouped.filter((item) => item.count > 0);
}

export async function getStudentVocabularyAnalytics(
  studentId: string
): Promise<StudentVocabularyAnalytics> {
  const supabase = await createServerSupabaseClient();
  const now = new Date();
  const sevenDaysAgo = now.getTime() - 1000 * 60 * 60 * 24 * 7;
  const thirtyDaysAgo = now.getTime() - 1000 * 60 * 60 * 24 * 30;

  const [attemptsResult, wordProgressResult] = await Promise.all([
    supabase
      .from("exercise_attempts")
      .select(
        "id, session_id, exercise_type, target_word_id, target_word, modality, is_correct, response_time_ms, created_at"
      )
      .eq("student_id", studentId)
      .order("created_at", { ascending: false }),
    supabase
      .from("word_progress")
      .select(
        "id, word, word_id, lifecycle_state, mastery_score, total_attempts, correct_attempts, last_seen_at, next_review_at, consecutive_incorrect, consecutive_correct, source_lesson_id"
      )
      .eq("student_id", studentId),
  ]);

  if (attemptsResult.error) {
    throw attemptsResult.error;
  }

  if (wordProgressResult.error) {
    throw wordProgressResult.error;
  }

  const attempts = (attemptsResult.data ?? []) as AttemptAnalyticsRow[];
  const wordProgressRows = (wordProgressResult.data ?? []) as WordProgressAnalyticsRow[];
  const totalExercisesCompleted = attempts.length;
  const totalCorrect = attempts.filter((attempt) => attempt.is_correct).length;
  const overallAccuracy = toAccuracy(totalCorrect, totalExercisesCompleted);
  const averageResponseTimeMs = average(
    attempts
      .map((attempt) => Number(attempt.response_time_ms))
      .filter((value) => Number.isFinite(value) && value > 0)
  );
  const recentSessions = buildRecentSessions(attempts);
  const recentSessionCount7d = recentSessions.filter(
    (session) => new Date(session.lastActivityAt).getTime() >= sevenDaysAgo
  ).length;
  const recentSessionCount30d = recentSessions.filter(
    (session) => new Date(session.lastActivityAt).getTime() >= thirtyDaysAgo
  ).length;
  const allWeakWords = buildWeakWords(wordProgressRows);
  const recentWeakWords = allWeakWords.slice(0, 8);
  const improvedWords7d = buildImprovedWords(attempts, now);

  return {
    summary: {
      totalExercisesCompleted,
      overallAccuracy,
      averageResponseTimeMs,
      weakWordCount: allWeakWords.length,
      recentSessionCount7d,
      recentSessionCount30d,
      wordsImproved7dCount: improvedWords7d.length,
    },
    accuracyByExerciseType: summarizeAccuracyByKey(
      attempts,
      (attempt) => attempt.exercise_type
    ),
    accuracyByModality: summarizeAccuracyByKey(attempts, (attempt) => attempt.modality),
    recentWeakWords,
    masteryDistribution: buildMasteryDistribution(wordProgressRows),
    recentSessions: recentSessions.slice(0, 6),
    mostMissedWords: buildMostMissedWords(attempts),
    improvedWords7d,
  };
}
