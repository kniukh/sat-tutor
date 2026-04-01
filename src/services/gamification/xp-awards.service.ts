import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  awardStudentXpEvent,
  getStudentGamificationSnapshot,
} from "@/services/gamification/gamification.service";
import {
  calculateReadingMistakeFixXp,
  calculateReadingLessonCompletionXp,
  calculateReadingQuestionXp,
  calculateVocabularyExerciseXp,
  calculateVocabularySessionReward,
  type ReadingLessonXpBreakdown,
  type ReadingQuestionXpBreakdown,
  type VocabularyExerciseXpBreakdown,
  type VocabularySessionXpBreakdown,
} from "@/services/gamification/xp-policy.service";
import type { SupportedVocabExercise } from "@/types/vocab-exercises";
import type { ExerciseAttemptRow, VocabularySessionRow, WordLifecycleState } from "@/types/vocab-tracking";

async function getVocabularyWordSessionStats(params: {
  studentId: string;
  sessionId: string;
  targetWordId?: string | null;
  targetWord?: string | null;
}) {
  const supabase = await createServerSupabaseClient();
  const normalizedWord = params.targetWord?.trim() ?? null;

  let attemptsQuery = supabase
    .from("exercise_attempts")
    .select("id")
    .eq("student_id", params.studentId)
    .eq("session_id", params.sessionId);

  let xpEventsQuery = supabase
    .from("xp_events")
    .select("xp_awarded")
    .eq("student_id", params.studentId)
    .eq("event_type", "vocab_exercise_attempt")
    .eq("vocab_session_id", params.sessionId);

  if (params.targetWordId) {
    attemptsQuery = attemptsQuery.eq("target_word_id", params.targetWordId);
    xpEventsQuery = xpEventsQuery.eq("target_word_id", params.targetWordId);
  } else if (normalizedWord) {
    attemptsQuery = attemptsQuery.eq("target_word", normalizedWord);
    xpEventsQuery = xpEventsQuery.eq("target_word", normalizedWord);
  } else {
    return {
      exposureIndex: 1,
      alreadyAwardedForWordThisSession: 0,
    };
  }

  const [{ data: attempts }, { data: xpEvents }] = await Promise.all([attemptsQuery, xpEventsQuery]);

  return {
    exposureIndex: Math.max(1, (attempts ?? []).length),
    alreadyAwardedForWordThisSession: (xpEvents ?? []).reduce(
      (sum, event: any) => sum + Number(event.xp_awarded ?? 0),
      0
    ),
  };
}

async function getVocabularySessionComboCount(params: {
  studentId: string;
  sessionId: string;
}) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("exercise_attempts")
    .select("is_correct")
    .eq("student_id", params.studentId)
    .eq("session_id", params.sessionId)
    .order("created_at", { ascending: false })
    .limit(16);

  if (error) {
    throw error;
  }

  let combo = 0;

  for (const attempt of data ?? []) {
    if (!attempt?.is_correct) {
      break;
    }

    combo += 1;
  }

  return combo;
}

async function getReadingLessonComboCount(params: {
  studentId: string;
  lessonId: string;
}) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("question_attempts")
    .select("is_correct")
    .eq("student_id", params.studentId)
    .eq("lesson_id", params.lessonId)
    .order("answered_at", { ascending: false })
    .limit(16);

  if (error) {
    throw error;
  }

  let combo = 0;

  for (const attempt of data ?? []) {
    if (!attempt?.is_correct) {
      break;
    }

    combo += 1;
  }

  return combo;
}

async function getRecentMicroSessionCount(params: {
  studentId: string;
  sessionId: string;
  lookbackMinutes?: number;
}) {
  const supabase = await createServerSupabaseClient();
  const now = Date.now();
  const lookbackMinutes = params.lookbackMinutes ?? 45;
  const cutoffIso = new Date(now - lookbackMinutes * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("vocab_sessions")
    .select("session_id, exercise_count, completed_at")
    .eq("student_id", params.studentId)
    .neq("session_id", params.sessionId)
    .not("completed_at", "is", null)
    .gte("completed_at", cutoffIso)
    .order("completed_at", { ascending: false })
    .limit(8);

  if (error) {
    throw error;
  }

  return (data ?? []).filter((session: any) => Number(session.exercise_count ?? 0) < 5).length;
}

function inferLifecycleState(
  exercise: SupportedVocabExercise,
  fallbackState?: WordLifecycleState | null
) {
  return (exercise.reviewMeta?.lifecycleState ?? fallbackState ?? null) as WordLifecycleState | null;
}

export async function awardVocabularyExerciseXp(params: {
  studentId: string;
  attempt: ExerciseAttemptRow;
  exercise: SupportedVocabExercise;
  sameSessionCreditCapped?: boolean;
  resultingLifecycleState?: WordLifecycleState | null;
}) {
  const sessionWordStats = await getVocabularyWordSessionStats({
    studentId: params.studentId,
    sessionId: params.attempt.session_id,
    targetWordId: params.attempt.target_word_id,
    targetWord: params.attempt.target_word,
  });
  const comboCountAfter = await getVocabularySessionComboCount({
    studentId: params.studentId,
    sessionId: params.attempt.session_id,
  });
  const breakdown = calculateVocabularyExerciseXp({
    isCorrect: params.attempt.is_correct,
    attemptCount: Number(params.attempt.attempt_count ?? 1),
    comboCountAfter,
    alreadyAwardedForWordThisSession: sessionWordStats.alreadyAwardedForWordThisSession,
    sameSessionCreditCapped: params.sameSessionCreditCapped,
  });
  const reward = await awardStudentXpEvent({
    studentId: params.studentId,
    xpToAdd: breakdown.totalXp,
    eventType: "vocab_exercise_attempt",
    eventKey: `vocab-exercise-attempt:${params.attempt.id}`,
    exerciseAttemptId: params.attempt.id,
    vocabSessionId: params.attempt.session_id,
    lessonId: params.attempt.lesson_id,
    targetWordId: params.attempt.target_word_id,
    targetWord: params.attempt.target_word,
    metadata: {
      exerciseType: params.attempt.exercise_type,
      modality: params.attempt.modality,
      difficultyBand: params.attempt.difficulty_band,
      isCorrect: params.attempt.is_correct,
      attemptCount: params.attempt.attempt_count,
      reviewMeta: {
        lifecycleState: inferLifecycleState(params.exercise, params.resultingLifecycleState),
        queueBucket: params.exercise.reviewMeta?.queueBucket ?? null,
        continuationSourceBucket: params.exercise.reviewMeta?.continuationSourceBucket ?? null,
        sessionPhase: params.exercise.reviewMeta?.sessionPhase ?? null,
        adaptiveDifficultyBand: params.exercise.reviewMeta?.adaptiveDifficultyBand ?? null,
      },
      antiAbuse: {
        exposureIndex: sessionWordStats.exposureIndex,
        sameSessionMultiplier: breakdown.sameSessionMultiplier,
        alreadyAwardedForWordThisSession: breakdown.alreadyAwardedForWordThisSession,
        perWordSessionCap: breakdown.perWordSessionCap,
        capRemaining: breakdown.capRemaining,
        sameSessionCreditCapped: Boolean(params.sameSessionCreditCapped),
      },
      xpBreakdown: breakdown,
    },
  });

  return {
    ...reward,
    breakdown,
  } satisfies {
    breakdown: VocabularyExerciseXpBreakdown;
    gamification: Awaited<ReturnType<typeof getStudentGamificationSnapshot>>;
    xpAwarded: number;
    event: unknown;
    deduplicated: boolean;
  };
}

export async function awardReadingQuestionXp(params: {
  studentId: string;
  lessonId: string;
  questionAttemptId: string;
  questionId: string;
  questionType?: string | null;
  isCorrect: boolean;
}) {
  const breakdown = calculateReadingQuestionXp({
    isCorrect: params.isCorrect,
    comboCountAfter: await getReadingLessonComboCount({
      studentId: params.studentId,
      lessonId: params.lessonId,
    }),
  });
  const reward = await awardStudentXpEvent({
    studentId: params.studentId,
    xpToAdd: breakdown.totalXp,
    eventType: "reading_question_attempt",
    eventKey: `reading-question-attempt:${params.questionAttemptId}`,
    questionAttemptId: params.questionAttemptId,
    lessonId: params.lessonId,
    metadata: {
      questionId: params.questionId,
      questionType: params.questionType ?? null,
      isCorrect: params.isCorrect,
      xpBreakdown: breakdown,
    },
  });

  return {
    ...reward,
    breakdown,
  } satisfies {
    breakdown: ReadingQuestionXpBreakdown;
    gamification: Awaited<ReturnType<typeof getStudentGamificationSnapshot>>;
    xpAwarded: number;
    event: unknown;
    deduplicated: boolean;
  };
}

export async function awardReadingMistakeFixXp(params: {
  studentId: string;
  lessonId: string;
  questionId: string;
  comboCountAfter: number;
}) {
  const breakdown = calculateReadingMistakeFixXp({
    comboCountAfter: params.comboCountAfter,
  });
  const reward = await awardStudentXpEvent({
    studentId: params.studentId,
    xpToAdd: breakdown.totalXp,
    eventType: "generic_activity",
    eventKey: `reading-mistake-fix:${params.lessonId}:${params.questionId}`,
    lessonId: params.lessonId,
    metadata: {
      rewardKind: "reading_mistake_fix",
      questionId: params.questionId,
      xpBreakdown: breakdown,
    },
  });

  return {
    ...reward,
    breakdown,
  } satisfies {
    breakdown: ReadingQuestionXpBreakdown;
    gamification: Awaited<ReturnType<typeof getStudentGamificationSnapshot>>;
    xpAwarded: number;
    event: unknown;
    deduplicated: boolean;
  };
}

export async function awardReadingLessonCompletionXp(params: {
  studentId: string;
  lessonId: string;
  lessonAttemptId: string;
  totalQuestions: number;
  accuracy: number;
}) {
  const breakdown = calculateReadingLessonCompletionXp({
    totalQuestions: params.totalQuestions,
    accuracy: params.accuracy,
  });
  const reward = await awardStudentXpEvent({
    studentId: params.studentId,
    xpToAdd: breakdown.totalXp,
    eventType: "reading_lesson_complete",
    eventKey: `reading-lesson-complete:${params.lessonAttemptId}`,
    lessonAttemptId: params.lessonAttemptId,
    lessonId: params.lessonId,
    metadata: {
      totalQuestions: params.totalQuestions,
      accuracy: params.accuracy,
      xpBreakdown: breakdown,
    },
  });

  return {
    ...reward,
    breakdown,
  } satisfies {
    breakdown: ReadingLessonXpBreakdown;
    gamification: Awaited<ReturnType<typeof getStudentGamificationSnapshot>>;
    xpAwarded: number;
    event: unknown;
    deduplicated: boolean;
  };
}

export async function awardVocabularySessionCompletionXp(params: {
  studentId: string;
  session: VocabularySessionRow;
  accuracy: number;
  completedCount: number;
}) {
  const recentMicroSessionCount = await getRecentMicroSessionCount({
    studentId: params.studentId,
    sessionId: params.session.session_id,
  });
  const sessionMetadata =
    params.session.metadata && typeof params.session.metadata === "object"
      ? (params.session.metadata as Record<string, unknown>)
      : {};
  const breakdown = calculateVocabularySessionReward({
    completedCount: params.completedCount,
    accuracy: params.accuracy,
    sessionMode: params.session.mode,
    sessionPhase:
      typeof sessionMetadata.session_phase === "string"
        ? (sessionMetadata.session_phase as any)
        : null,
    recentMicroSessionCount,
  });
  const reward = await awardStudentXpEvent({
    studentId: params.studentId,
    xpToAdd: breakdown.totalXp,
    eventType: "vocab_session_complete",
    eventKey: `vocab-session-complete:${params.session.session_id}`,
    vocabSessionId: params.session.session_id,
    metadata: {
      sessionMode: params.session.mode,
      sessionPhase: sessionMetadata.session_phase ?? null,
      completedCount: params.completedCount,
      correctCount: Number(params.session.correct_count ?? 0),
      exerciseCount: Number(params.session.exercise_count ?? 0),
      accuracy: params.accuracy,
      xpBreakdown: breakdown,
    },
  });

  return {
    ...reward,
    breakdown,
  } satisfies {
    breakdown: VocabularySessionXpBreakdown;
    gamification: Awaited<ReturnType<typeof getStudentGamificationSnapshot>>;
    xpAwarded: number;
    event: unknown;
    deduplicated: boolean;
  };
}
