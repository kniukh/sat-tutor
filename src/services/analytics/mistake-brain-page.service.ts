import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getStudentVocabularyAnalytics } from "@/services/analytics/vocabulary-analytics.service";
import {
  classifyReviewQueueCandidate,
  generateReviewQueueForStudent,
  listActiveReviewQueueCandidates,
  type ReviewQueuePriorityBucket,
} from "@/services/vocabulary/review-queue.service";
import type { VocabExerciseType, VocabModality, WordLifecycleState } from "@/types/vocab-tracking";

type SkillPerformanceItem = {
  skill: string;
  attempts: number;
  correct: number;
  accuracy: number;
};

type ReviewWordItem = {
  wordId: string | null;
  word: string;
  lifecycleState: WordLifecycleState;
  masteryScore: number;
  priorityBucket: ReviewQueuePriorityBucket | null;
  consecutiveIncorrect?: number;
  nextReviewAt?: string | null;
  sourceLessonId?: string | null;
};

type RecentlyMissedItem = {
  wordId: string | null;
  word: string;
  wrongCount: number;
  totalAttempts: number;
  accuracy: number;
  lastSeenAt: string | null;
};

type BrainPatternItem = {
  id: string;
  title: string;
  detail: string;
};

type BrainRecommendationItem = {
  id: string;
  label: string;
  href: string;
  variant: "primary" | "secondary";
  description?: string;
};

type ModalityPerformanceItem = {
  key: VocabModality;
  attempts: number;
  correct: number;
  accuracy: number;
};

type ExerciseTypePerformanceItem = {
  key: VocabExerciseType;
  attempts: number;
  correct: number;
  accuracy: number;
};

type QuestionAttemptRow = {
  question_id: string;
  is_correct: boolean;
  duration_sec: number | null;
};

type QuestionTypeRow = {
  id: string;
  question_type: string | null;
};

type WordProgressBrainRow = {
  word_id: string | null;
  word: string;
  lifecycle_state: WordLifecycleState;
  mastery_score: number | null;
  consecutive_incorrect: number | null;
  next_review_at: string | null;
  source_lesson_id: string | null;
};

export type MistakeBrainPageData = {
  student: {
    id: string;
    fullName: string;
    accessCode: string;
  };
  overview: {
    totalAttempts: number;
    accuracy: number;
    sessionsCompleted: number;
    averageResponseTimeMs: number | null;
    readingAttempts: number;
    vocabAttempts: number;
  };
  weakSkills: SkillPerformanceItem[];
  reviewLists: {
    weakWords: ReviewWordItem[];
    learningWords: ReviewWordItem[];
    recentlyMissed: RecentlyMissedItem[];
    masteredSummary: {
      count: number;
      averageMasteryScore: number;
    };
  };
  deeperStats: {
    modalityPerformance: ModalityPerformanceItem[];
    exerciseTypePerformance: ExerciseTypePerformanceItem[];
    recentSessionCount7d: number;
    recentSessionCount30d: number;
    practicedTodayWords: number;
  };
  patterns: BrainPatternItem[];
  recommendations: BrainRecommendationItem[];
};

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function toAccuracy(correct: number, attempts: number) {
  return attempts > 0 ? correct / attempts : 0;
}

function formatSkillLabel(skill: string) {
  return skill.replace(/_/g, " ");
}

function buildSkillPerformance(
  attempts: QuestionAttemptRow[],
  questionTypeMap: Map<string, string>
) {
  const grouped = new Map<string, { attempts: number; correct: number }>();

  for (const attempt of attempts) {
    const key = questionTypeMap.get(attempt.question_id) ?? "reading";
    const current = grouped.get(key) ?? { attempts: 0, correct: 0 };
    current.attempts += 1;
    if (attempt.is_correct) {
      current.correct += 1;
    }
    grouped.set(key, current);
  }

  return Array.from(grouped.entries())
    .map(([skill, stats]) => ({
      skill,
      attempts: stats.attempts,
      correct: stats.correct,
      accuracy: toAccuracy(stats.correct, stats.attempts),
    }))
    .sort((left, right) => {
      if (left.accuracy !== right.accuracy) {
        return left.accuracy - right.accuracy;
      }

      return right.attempts - left.attempts;
    });
}

function buildPatterns(params: {
  weakSkills: SkillPerformanceItem[];
  modalityPerformance: ModalityPerformanceItem[];
  exerciseTypePerformance: ExerciseTypePerformanceItem[];
  vocabOverallAccuracy: number;
}) {
  const patterns: BrainPatternItem[] = [];
  const topWeakSkill = params.weakSkills.find((item) => item.attempts >= 2 && item.accuracy < 0.72);

  if (topWeakSkill) {
    patterns.push({
      id: "weak-reading-skill",
      title: "Reading skill drag",
      detail: `${formatSkillLabel(topWeakSkill.skill)} is the weakest reading area right now at ${Math.round(topWeakSkill.accuracy * 100)}% accuracy.`,
    });
  }

  const audioPerformance = params.modalityPerformance.find(
    (item) => item.key === "audio" && item.attempts >= 4
  );
  const textBaseline = params.modalityPerformance
    .filter((item) => item.key !== "audio" && item.attempts >= 4)
    .sort((left, right) => right.accuracy - left.accuracy)[0];

  if (
    audioPerformance &&
    textBaseline &&
    audioPerformance.accuracy <= textBaseline.accuracy - 0.12
  ) {
    patterns.push({
      id: "audio-gap",
      title: "Audio is weaker than visual practice",
      detail: `Audio accuracy is ${Math.round(audioPerformance.accuracy * 100)}%, below ${textBaseline.key} at ${Math.round(textBaseline.accuracy * 100)}%.`,
    });
  }

  const contextMeaning = params.exerciseTypePerformance.find(
    (item) => item.key === "context_meaning" && item.attempts >= 4
  );
  if (
    contextMeaning &&
    contextMeaning.accuracy <= params.vocabOverallAccuracy - 0.1
  ) {
    patterns.push({
      id: "context-meaning",
      title: "Context meaning needs more reps",
      detail: `Context meaning drills are landing at ${Math.round(contextMeaning.accuracy * 100)}%, below the current vocabulary average.`,
    });
  }

  const synonym = params.exerciseTypePerformance.find(
    (item) => item.key === "synonym" && item.attempts >= 4
  );
  if (synonym && synonym.accuracy <= params.vocabOverallAccuracy - 0.1) {
    patterns.push({
      id: "synonym-confusion",
      title: "Synonym choices are causing confusion",
      detail: `Synonym drills are currently at ${Math.round(synonym.accuracy * 100)}%, which suggests meaning-level confusion more than recall trouble.`,
    });
  }

  return patterns.slice(0, 4);
}

function buildRecommendations(params: {
  accessCode: string;
  hasWeakWords: boolean;
  hasContextPattern: boolean;
  hasAudioPattern: boolean;
  revisitLessonId: string | null;
}) {
  const recommendations: BrainRecommendationItem[] = [];

  if (params.hasWeakWords) {
    recommendations.push({
      id: "review-weak-words",
      label: "Review Weak Words",
      href: `/s/${params.accessCode}/vocabulary/drill?mode=review_weak_words&phase=endless_continuation`,
      variant: "primary",
      description: "Hit the highest-friction words first.",
    });
  }

  if (params.hasContextPattern) {
    recommendations.push({
      id: "practice-context",
      label: "Practice Context Meaning",
      href: `/s/${params.accessCode}/vocabulary/drill?mode=mixed_practice&phase=endless_continuation`,
      variant: "secondary",
      description: "Use a fresh mixed session to surface more context reps.",
    });
  }

  if (params.hasAudioPattern) {
    recommendations.push({
      id: "start-audio",
      label: "Start Audio Practice",
      href: `/s/${params.accessCode}/vocabulary/drill?mode=mixed_practice&phase=endless_continuation`,
      variant: "secondary",
      description: "Build listening accuracy with the current adaptive mix.",
    });
  }

  if (params.revisitLessonId) {
    recommendations.push({
      id: "revisit-lesson",
      label: "Revisit Lesson Vocabulary",
      href: `/s/${params.accessCode}/vocabulary/drill?mode=learn_new_words&lesson=${params.revisitLessonId}`,
      variant: "secondary",
      description: "Return to words connected to a recent reading lesson.",
    });
  }

  return recommendations.slice(0, 4);
}

export async function getMistakeBrainPageData(code: string): Promise<MistakeBrainPageData> {
  const supabase = await createServerSupabaseClient();

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, full_name, access_code")
    .eq("access_code", code)
    .eq("is_active", true)
    .single();

  if (studentError || !student) {
    throw studentError ?? new Error("Student not found");
  }

  await generateReviewQueueForStudent({
    studentId: student.id,
    limit: 100,
  });

  const [
    questionAttemptsResult,
    lessonAttemptsResult,
    vocabSessionsResult,
    wordProgressResult,
    activeQueueCandidates,
    vocabularyAnalytics,
  ] = await Promise.all([
    supabase
      .from("question_attempts")
      .select("question_id, is_correct, duration_sec")
      .eq("student_id", student.id),
    supabase
      .from("lesson_attempts")
      .select("id")
      .eq("student_id", student.id),
    supabase
      .from("vocab_sessions")
      .select("session_id", { count: "exact" })
      .eq("student_id", student.id)
      .not("completed_at", "is", null),
    supabase
      .from("word_progress")
      .select(
        "word_id, word, lifecycle_state, mastery_score, consecutive_incorrect, next_review_at, source_lesson_id"
      )
      .eq("student_id", student.id),
    listActiveReviewQueueCandidates({
      studentId: student.id,
      limit: 100,
    }),
    getStudentVocabularyAnalytics(student.id),
  ]);

  if (questionAttemptsResult.error) {
    throw questionAttemptsResult.error;
  }

  if (lessonAttemptsResult.error) {
    throw lessonAttemptsResult.error;
  }

  if (vocabSessionsResult.error) {
    throw vocabSessionsResult.error;
  }

  if (wordProgressResult.error) {
    throw wordProgressResult.error;
  }

  const questionAttempts = (questionAttemptsResult.data ?? []) as QuestionAttemptRow[];
  const questionIds = Array.from(new Set(questionAttempts.map((item) => item.question_id).filter(Boolean)));

  const questionTypeMap = new Map<string, string>();
  if (questionIds.length > 0) {
    const { data: questionRows, error: questionRowsError } = await supabase
      .from("question_bank")
      .select("id, question_type")
      .in("id", questionIds);

    if (questionRowsError) {
      throw questionRowsError;
    }

    for (const row of (questionRows ?? []) as QuestionTypeRow[]) {
      questionTypeMap.set(row.id, row.question_type ?? "reading");
    }
  }

  const weakSkills = buildSkillPerformance(questionAttempts, questionTypeMap);
  const questionCorrectCount = questionAttempts.filter((item) => item.is_correct).length;
  const questionResponseTimes = questionAttempts
    .map((item) => (item.duration_sec ? item.duration_sec * 1000 : null))
    .filter((value): value is number => typeof value === "number" && value > 0);

  const vocabAttemptCount = vocabularyAnalytics.accuracyByExerciseType.reduce(
    (sum, item) => sum + item.attempts,
    0
  );
  const vocabCorrectCount = vocabularyAnalytics.accuracyByExerciseType.reduce(
    (sum, item) => sum + item.correct,
    0
  );
  const totalAttempts = questionAttempts.length + vocabAttemptCount;
  const totalCorrect = questionCorrectCount + vocabCorrectCount;
  const weightedVocabResponseTotal =
    vocabularyAnalytics.summary.averageResponseTimeMs !== null
      ? vocabularyAnalytics.summary.averageResponseTimeMs * vocabAttemptCount
      : 0;
  const totalResponseSamples =
    questionResponseTimes.length +
    (vocabularyAnalytics.summary.averageResponseTimeMs !== null ? vocabAttemptCount : 0);
  const averageResponseTimeMs =
    totalResponseSamples > 0
      ? Math.round(
          (questionResponseTimes.reduce((sum, value) => sum + value, 0) + weightedVocabResponseTotal) /
            totalResponseSamples
        )
      : null;

  const queueBucketMap = new Map(
    activeQueueCandidates.map((candidate) => [
      candidate.word_id,
      classifyReviewQueueCandidate(candidate, new Date()),
    ])
  );

  const wordProgressRows = (wordProgressResult.data ?? []) as WordProgressBrainRow[];
  const weakWords: ReviewWordItem[] = vocabularyAnalytics.recentWeakWords
    .map((item) => ({
      wordId: item.wordId,
      word: item.word,
      lifecycleState: item.lifecycleState,
      masteryScore: item.masteryScore,
      priorityBucket: item.wordId ? queueBucketMap.get(item.wordId) ?? null : null,
      consecutiveIncorrect: item.consecutiveIncorrect,
      nextReviewAt: item.nextReviewAt,
      sourceLessonId: item.sourceLessonId,
    }))
    .slice(0, 6);

  const learningWords: ReviewWordItem[] = wordProgressRows
    .filter((row) => row.lifecycle_state === "new" || row.lifecycle_state === "learning")
    .map((row) => ({
      wordId: row.word_id,
      word: row.word,
      lifecycleState: row.lifecycle_state,
      masteryScore: Number(row.mastery_score ?? 0),
      priorityBucket: row.word_id ? queueBucketMap.get(row.word_id) ?? null : null,
      consecutiveIncorrect: Number(row.consecutive_incorrect ?? 0),
      nextReviewAt: row.next_review_at,
      sourceLessonId: row.source_lesson_id,
    }))
    .sort((left, right) => {
      if (left.masteryScore !== right.masteryScore) {
        return left.masteryScore - right.masteryScore;
      }

      return (right.consecutiveIncorrect ?? 0) - (left.consecutiveIncorrect ?? 0);
    })
    .slice(0, 6);

  const masteredSummaryRow = vocabularyAnalytics.masteryDistribution.find(
    (item) => item.lifecycleState === "mastered"
  );
  const revisitLessonId =
    weakWords.find((item) => item.sourceLessonId)?.sourceLessonId ??
    learningWords.find((item) => item.sourceLessonId)?.sourceLessonId ??
    null;

  const patterns = buildPatterns({
    weakSkills,
    modalityPerformance: vocabularyAnalytics.accuracyByModality,
    exerciseTypePerformance: vocabularyAnalytics.accuracyByExerciseType,
    vocabOverallAccuracy: vocabularyAnalytics.summary.overallAccuracy,
  });

  const recommendations = buildRecommendations({
    accessCode: student.access_code,
    hasWeakWords: weakWords.length > 0,
    hasContextPattern: patterns.some((item) => item.id === "context-meaning"),
    hasAudioPattern: patterns.some((item) => item.id === "audio-gap"),
    revisitLessonId,
  });

  return {
    student: {
      id: student.id,
      fullName: student.full_name,
      accessCode: student.access_code,
    },
    overview: {
      totalAttempts,
      accuracy: toAccuracy(totalCorrect, totalAttempts),
      sessionsCompleted:
        (lessonAttemptsResult.data ?? []).length + Number(vocabSessionsResult.count ?? 0),
      averageResponseTimeMs,
      readingAttempts: questionAttempts.length,
      vocabAttempts: vocabAttemptCount,
    },
    weakSkills,
    reviewLists: {
      weakWords,
      learningWords,
      recentlyMissed: vocabularyAnalytics.mostMissedWords.slice(0, 6),
      masteredSummary: {
        count: vocabularyAnalytics.summary.masteredWordsCount,
        averageMasteryScore: masteredSummaryRow?.averageMasteryScore ?? 0,
      },
    },
    deeperStats: {
      modalityPerformance: vocabularyAnalytics.accuracyByModality,
      exerciseTypePerformance: vocabularyAnalytics.accuracyByExerciseType,
      recentSessionCount7d: vocabularyAnalytics.summary.recentSessionCount7d,
      recentSessionCount30d: vocabularyAnalytics.summary.recentSessionCount30d,
      practicedTodayWords: vocabularyAnalytics.summary.practicedTodayWordsCount,
    },
    patterns,
    recommendations,
  };
}
