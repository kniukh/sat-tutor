import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  adaptClozeDrillsToExercises,
  adaptMeaningDrillsToExercises,
} from "@/services/vocabulary/exercise-adapters";
import {
  classifyReviewQueueCandidate,
  generateReviewQueueForStudent,
  getNextReviewQueueCandidates,
  listActiveReviewQueueCandidates,
  type ReviewQueueCandidate,
  type ReviewQueuePriorityBucket,
} from "@/services/vocabulary/review-queue.service";
import {
  buildVocabExerciseSession,
  type VocabExerciseSession,
  type VocabSessionMode,
} from "@/services/vocabulary/session-builder";
import {
  getExerciseTargetWordId,
  type SupportedVocabExercise,
} from "@/types/vocab-exercises";

type VocabularyPageStudent = {
  id: string;
  fullName: string;
  accessCode: string;
};

type DrillItem = {
  wordProgressId: string;
  vocabularyItemId: string;
  itemText: string;
  itemType: "word" | "phrase";
  correctAnswer: string;
  distractors: string[];
  contextSentence: string;
};

type QueueBucketCounts = Record<ReviewQueuePriorityBucket, number>;

export type VocabularyPageMode = Extract<
  VocabSessionMode,
  "learn_new_words" | "review_weak_words" | "mixed_practice"
>;

export type StudentVocabularyPageData = {
  student: VocabularyPageStudent;
  selectedMode: VocabularyPageMode;
  summary: {
    totalQueueItems: number;
    dueNowCount: number;
    readyDrillsCount: number;
    readyPercent: number;
    newWordPoolCount: number;
    bucketCounts: QueueBucketCounts;
    topPriorityBucket: ReviewQueuePriorityBucket | null;
    topPriorityLabel: string | null;
    upcomingWords: string[];
    learnNewWords: {
      newestCapturedItems: string[];
      recentLessons: Array<{
        lessonId: string;
        lessonName: string;
        readyNewWordCount: number;
      }>;
    };
  };
  drillCounts: {
    words: number;
    phrases: number;
    cloze: number;
  };
  session: VocabExerciseSession | null;
  preparationNeeded: boolean;
};

const EMPTY_BUCKET_COUNTS: QueueBucketCounts = {
  recently_failed: 0,
  weak_again: 0,
  overdue: 0,
  reinforcement: 0,
  scheduled: 0,
};

const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";

function getBucketLabel(bucket: ReviewQueuePriorityBucket | null) {
  switch (bucket) {
    case "recently_failed":
      return "Recently failed words";
    case "weak_again":
      return "Weak again words";
    case "overdue":
      return "Overdue review words";
    case "reinforcement":
      return "Learning reinforcement";
    case "scheduled":
      return "Scheduled review";
    default:
      return null;
  }
}

function pickTopPriorityBucket(bucketCounts: QueueBucketCounts) {
  const priorityOrder: ReviewQueuePriorityBucket[] = [
    "recently_failed",
    "weak_again",
    "overdue",
    "reinforcement",
    "scheduled",
  ];

  for (const bucket of priorityOrder) {
    if (bucketCounts[bucket] > 0) {
      return bucket;
    }
  }

  return null;
}

export function normalizeVocabularyPageMode(mode: string | undefined): VocabularyPageMode {
  if (mode === "review_weak_words") return "review_weak_words";
  if (mode === "learn_new_words") return "learn_new_words";
  return "mixed_practice";
}

function toDrillItem(detail: any, wordProgressId: string): DrillItem | null {
  if (
    !detail ||
    !detail.id ||
    !detail.item_text ||
    !detail.english_explanation ||
    !Array.isArray(detail.distractors) ||
    detail.distractors.length < 3
  ) {
    return null;
  }

  const itemType = (detail.item_type ?? "word") as "word" | "phrase";
  const correctAnswer =
    itemType === "phrase"
      ? detail.example_text || detail.english_explanation
      : detail.english_explanation;

  return {
    wordProgressId,
    vocabularyItemId: detail.id,
    itemText: detail.item_text,
    itemType,
    correctAnswer,
    distractors: detail.distractors,
    contextSentence: detail.context_sentence || "",
  };
}

function attachQueueReviewMeta<TExercise extends SupportedVocabExercise>(
  exercises: TExercise[],
  queueCandidateMap: Map<string, ReviewQueueCandidate>,
  wordProgressMap: Map<string, any>
) {
  return exercises.map((exercise) => {
    const targetWordId = getExerciseTargetWordId(exercise);
    const candidate = queueCandidateMap.get(targetWordId);
    const wordProgress = wordProgressMap.get(targetWordId);

    if (!candidate) {
      return exercise;
    }

    return {
      ...exercise,
      reviewMeta: {
        ...(exercise.reviewMeta ?? {}),
        attemptCount: wordProgress?.total_attempts ?? exercise.reviewMeta?.attemptCount,
        dueAt: candidate.scheduled_for,
        lastReviewedAt: wordProgress?.last_seen_at ?? null,
        queueBucket: classifyReviewQueueCandidate(candidate, new Date()),
        queueReason: candidate.reason,
        queuePriorityScore: candidate.priority_score,
      },
    };
  });
}

function attachNewWordReviewMeta<TExercise extends { reviewMeta?: Record<string, any> }>(
  exercises: TExercise[]
) {
  return exercises.map((exercise) => ({
    ...exercise,
    reviewMeta: {
      ...(exercise.reviewMeta ?? {}),
      queueBucket: "scheduled" as const,
      queueReason: "new_word_introduction",
      queuePriorityScore: 0.2,
      attemptCount: exercise.reviewMeta?.attemptCount ?? 0,
    },
  }));
}

function buildExercisePoolFromDrillItems(drillItems: DrillItem[]) {
  const wordDrills = drillItems.filter((item) => item.itemType === "word");
  const phraseDrills = drillItems.filter((item) => item.itemType === "phrase");
  const clozeDrills = drillItems.filter((item) => item.contextSentence);

  return {
    wordDrills,
    phraseDrills,
    clozeDrills,
    exercises: [
      ...adaptMeaningDrillsToExercises(wordDrills),
      ...adaptMeaningDrillsToExercises(phraseDrills),
      ...adaptClozeDrillsToExercises(clozeDrills),
    ],
  };
}

export async function getStudentVocabularyPageData(
  accessCode: string,
  selectedMode: VocabularyPageMode = "mixed_practice"
) {
  const supabase = await createServerSupabaseClient();

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, full_name, access_code")
    .eq("access_code", accessCode)
    .eq("is_active", true)
    .single();

  if (studentError || !student) {
    throw new Error("Student not found");
  }

  const studentData: VocabularyPageStudent = {
    id: student.id,
    fullName: student.full_name,
    accessCode: student.access_code,
  };

  await generateReviewQueueForStudent({
    studentId: studentData.id,
    limit: 150,
  });

  const [activeQueueCandidates, nextQueueCandidates, allVocabDetails, attemptedWordIds] =
    await Promise.all([
      listActiveReviewQueueCandidates({
        studentId: studentData.id,
        limit: 150,
      }),
      getNextReviewQueueCandidates({
        studentId: studentData.id,
        limit: 8,
        dueOnly: false,
      }),
      supabase
        .from("vocabulary_item_details")
        .select("*")
        .eq("student_id", studentData.id)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("exercise_attempts")
        .select("target_word_id")
        .eq("student_id", studentData.id)
        .not("target_word_id", "is", null),
    ]);

  if (allVocabDetails.error) {
    throw allVocabDetails.error;
  }

  if (attemptedWordIds.error) {
    throw attemptedWordIds.error;
  }

  const now = new Date();
  const bucketCounts = activeQueueCandidates.reduce<QueueBucketCounts>((acc, candidate) => {
    const bucket = classifyReviewQueueCandidate(candidate, now);
    acc[bucket] += 1;
    return acc;
  }, { ...EMPTY_BUCKET_COUNTS });

  const queueWordIds = Array.from(
    new Set(activeQueueCandidates.map((candidate) => candidate.word_id).filter(Boolean))
  );

  const { data: wordProgressRows, error: wordProgressError } = await supabase
    .from("word_progress")
    .select("*")
    .eq("student_id", studentData.id)
    .in("word_id", queueWordIds.length > 0 ? queueWordIds : [EMPTY_UUID]);

  if (wordProgressError) {
    throw wordProgressError;
  }

  const { data: queueVocabDetails, error: queueVocabDetailsError } = await supabase
    .from("vocabulary_item_details")
    .select("*")
    .eq("student_id", studentData.id)
    .in("id", queueWordIds.length > 0 ? queueWordIds : [EMPTY_UUID]);

  if (queueVocabDetailsError) {
    throw queueVocabDetailsError;
  }

  const wordProgressMap = new Map((wordProgressRows ?? []).map((row) => [row.word_id, row]));
  const queueVocabDetailMap = new Map(
    (queueVocabDetails ?? []).map((row: any) => [row.id, row])
  );
  const queueCandidateMap = new Map(
    activeQueueCandidates.map((candidate) => [candidate.word_id, candidate])
  );

  const queueDrillItems = activeQueueCandidates
    .map((candidate) => {
      const detail = queueVocabDetailMap.get(candidate.word_id);
      const wordProgress = wordProgressMap.get(candidate.word_id);
      if (!wordProgress) return null;
      return toDrillItem(detail, wordProgress.id);
    })
    .filter(Boolean) as DrillItem[];

  const queueExercisePool = buildExercisePoolFromDrillItems(queueDrillItems);
  const queueExercises = [
    ...attachQueueReviewMeta(queueExercisePool.exercises, queueCandidateMap, wordProgressMap),
  ];

  const attemptedWordIdSet = new Set(
    (attemptedWordIds.data ?? []).map((row: any) => row.target_word_id).filter(Boolean)
  );
  const activeQueueWordIdSet = new Set(queueWordIds);

  const newWordDrillItems = (allVocabDetails.data ?? [])
    .filter((detail: any) => {
      if (!detail?.id) return false;
      if (activeQueueWordIdSet.has(detail.id)) return false;
      if (attemptedWordIdSet.has(detail.id)) return false;
      if (detail.is_understood === true) return false;
      return true;
    })
    .map((detail: any) => toDrillItem(detail, `new:${detail.id}`))
    .filter(Boolean) as DrillItem[];

  const recentNewWordDetails = (allVocabDetails.data ?? []).filter((detail: any) => {
    if (!detail?.id) return false;
    if (activeQueueWordIdSet.has(detail.id)) return false;
    if (attemptedWordIdSet.has(detail.id)) return false;
    if (detail.is_understood === true) return false;
    if (!detail.english_explanation) return false;
    if (!Array.isArray(detail.distractors) || detail.distractors.length < 3) return false;
    return true;
  });

  const recentLessonIds = Array.from(
    new Set(
      recentNewWordDetails
        .map((detail: any) => detail.lesson_id)
        .filter((lessonId: string | null) => Boolean(lessonId))
    )
  ).slice(0, 8);

  const { data: recentLessons, error: recentLessonsError } = await supabase
    .from("lessons")
    .select("id, name")
    .in("id", recentLessonIds.length > 0 ? recentLessonIds : [EMPTY_UUID]);

  if (recentLessonsError) {
    throw recentLessonsError;
  }

  const recentLessonNameMap = new Map(
    (recentLessons ?? []).map((lesson: any) => [lesson.id, lesson.name as string])
  );

  const recentLessonsSummary = Array.from(
    recentNewWordDetails.reduce<
      Map<string, { lessonId: string; lessonName: string; readyNewWordCount: number }>
    >((acc, detail: any) => {
      if (!detail.lesson_id) {
        return acc;
      }

      const existing = acc.get(detail.lesson_id);
      if (existing) {
        existing.readyNewWordCount += 1;
        return acc;
      }

      acc.set(detail.lesson_id, {
        lessonId: detail.lesson_id,
        lessonName: recentLessonNameMap.get(detail.lesson_id) ?? "Untitled lesson",
        readyNewWordCount: 1,
      });

      return acc;
    }, new Map()).values()
  )
    .sort((a, b) => b.readyNewWordCount - a.readyNewWordCount)
    .slice(0, 4);

  const newWordExercisePool = buildExercisePoolFromDrillItems(newWordDrillItems);
  const newWordExercises = attachNewWordReviewMeta(newWordExercisePool.exercises);

  const selectedExercisePool =
    selectedMode === "learn_new_words" ? newWordExercises : queueExercises;
  const selectedDrillCounts =
    selectedMode === "learn_new_words"
      ? newWordExercisePool
      : queueExercisePool;

  const today = new Date().toISOString().slice(0, 10);
  const session =
    selectedExercisePool.length > 0
      ? buildVocabExerciseSession({
          exercises: selectedExercisePool,
          mode: selectedMode,
          targetSize: Math.min(
            selectedMode === "learn_new_words" ? 6 : 8,
            selectedExercisePool.length
          ),
          seed: `${studentData.id}:${today}:${selectedMode}:${bucketCounts.recently_failed}:${bucketCounts.weak_again}:${bucketCounts.overdue}:${newWordExercises.length}`,
        })
      : null;

  const totalQueueItems = activeQueueCandidates.length;
  const readyDrillsCount = queueDrillItems.length;
  const topPriorityBucket = pickTopPriorityBucket(bucketCounts);

  return {
    student: studentData,
    selectedMode,
    summary: {
      totalQueueItems,
      dueNowCount: activeQueueCandidates.filter(
        (candidate) => new Date(candidate.scheduled_for).getTime() <= now.getTime()
      ).length,
      readyDrillsCount,
      readyPercent: totalQueueItems > 0 ? Math.round((readyDrillsCount / totalQueueItems) * 100) : 0,
      newWordPoolCount: newWordExercises.length,
      bucketCounts,
      topPriorityBucket,
      topPriorityLabel: getBucketLabel(topPriorityBucket),
      upcomingWords: nextQueueCandidates
        .map((candidate) => candidate.word)
        .filter((word): word is string => Boolean(word))
        .slice(0, 4),
      learnNewWords: {
        newestCapturedItems: recentNewWordDetails
          .map((detail: any) => detail.item_text)
          .filter((itemText: string | null) => Boolean(itemText))
          .slice(0, 6),
        recentLessons: recentLessonsSummary,
      },
    },
    drillCounts: {
      words: selectedDrillCounts.wordDrills.length,
      phrases: selectedDrillCounts.phraseDrills.length,
      cloze: selectedDrillCounts.clozeDrills.length,
    },
    session,
    preparationNeeded:
      selectedMode === "learn_new_words"
        ? newWordExercises.length === 0 && (allVocabDetails.data ?? []).length > 0
        : readyDrillsCount < totalQueueItems,
  } satisfies StudentVocabularyPageData;
}
