import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getChapterVocabularyProgress,
  refreshChapterVocabularyCheckpoint,
} from "@/services/reading/chapter-vocabulary.service";

export type GuidedLearningAction = "reading" | "vocabulary" | "completed";

export type GuidedLearningState = {
  assignmentId: string;
  sourceDocumentId: string;
  bookTitle: string;
  chapterIndex: number;
  chapterTitle: string;
  status: "assigned" | "in_progress" | "completed";
  action: GuidedLearningAction;
  nextLessonId: string | null;
  completedReadingCount: number;
  totalReadingCount: number;
  vocabularyCheckpointsCompleted: number;
  requiredVocabularyCheckpoints: number;
  pendingVocabularyCount: number;
  progressPercent: number;
};

type AssignmentRow = {
  id: string;
  source_document_id: string;
  chapter_index: number | null;
  status: "assigned" | "in_progress" | "completed" | "archived";
  vocabulary_checkpoints_completed: number | null;
};

type PassageRow = {
  lesson_id: string | null;
  chapter_index: number | null;
  chapter_title: string | null;
  chunk_index: number | null;
};

type LessonRow = {
  id: string;
  status: string | null;
  is_active: boolean | null;
};

function chapterLabel(chapterIndex: number, chapterTitle: string | null) {
  return chapterTitle?.trim() || `Chapter ${chapterIndex}`;
}

export async function getGuidedLearningState(
  studentId: string,
): Promise<GuidedLearningState | null> {
  const supabase = await createServerSupabaseClient();
  const { data: assignment, error: assignmentError } = await supabase
    .from("reading_assignments")
    .select("id, source_document_id, chapter_index, status, vocabulary_checkpoints_completed")
    .eq("student_id", studentId)
    .in("status", ["assigned", "in_progress", "completed"])
    .not("chapter_index", "is", null)
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle<AssignmentRow>();

  if (assignmentError) throw assignmentError;
  if (!assignment || assignment.chapter_index === null || assignment.status === "archived") {
    return null;
  }

  const chapterIndex = Number(assignment.chapter_index);
  const [{ data: source, error: sourceError }, { data: passages, error: passagesError }] =
    await Promise.all([
      supabase
        .from("source_documents")
        .select("id, title")
        .eq("id", assignment.source_document_id)
        .maybeSingle<{ id: string; title: string }>(),
      supabase
        .from("generated_passages")
        .select("lesson_id, chapter_index, chapter_title, chunk_index")
        .eq("source_document_id", assignment.source_document_id)
        .eq("chapter_index", chapterIndex)
        .not("lesson_id", "is", null)
        .order("chunk_index", { ascending: true })
        .returns<PassageRow[]>(),
    ]);

  if (sourceError) throw sourceError;
  if (passagesError) throw passagesError;
  if (!source) return null;

  const lessonIds = Array.from(
    new Set(
      (passages ?? [])
        .map((passage) => passage.lesson_id)
        .filter((lessonId): lessonId is string => Boolean(lessonId)),
    ),
  );

  if (lessonIds.length === 0) {
    return {
      assignmentId: assignment.id,
      sourceDocumentId: assignment.source_document_id,
      bookTitle: source.title,
      chapterIndex,
      chapterTitle: chapterLabel(chapterIndex, passages?.[0]?.chapter_title ?? null),
      status: assignment.status === "completed" ? "completed" : assignment.status,
      action: "reading",
      nextLessonId: null,
      completedReadingCount: 0,
      totalReadingCount: 0,
      vocabularyCheckpointsCompleted: Number(assignment.vocabulary_checkpoints_completed ?? 0),
      requiredVocabularyCheckpoints: 0,
      pendingVocabularyCount: 0,
      progressPercent: 0,
    };
  }

  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("id, status, is_active")
    .in("id", lessonIds)
    .eq("status", "published")
    .eq("is_active", true)
    .returns<LessonRow[]>();

  if (lessonsError) throw lessonsError;

  const publishedLessonIds = new Set((lessons ?? []).map((lesson) => lesson.id));
  const orderedLessonIds = (passages ?? [])
    .map((passage) => passage.lesson_id)
    .filter((lessonId): lessonId is string => Boolean(lessonId && publishedLessonIds.has(lessonId)));
  const uniqueOrderedLessonIds = Array.from(new Set(orderedLessonIds));

  const { data: attempts, error: attemptsError } = await supabase
    .from("lesson_attempts")
    .select("lesson_id")
    .eq("student_id", studentId)
    .in("lesson_id", uniqueOrderedLessonIds)
    .not("completed_at", "is", null);

  if (attemptsError) throw attemptsError;

  const completedLessonIds = new Set((attempts ?? []).map((attempt) => attempt.lesson_id));
  const completedReadingCount = uniqueOrderedLessonIds.filter((id) => completedLessonIds.has(id)).length;
  const nextLessonId = uniqueOrderedLessonIds.find((id) => !completedLessonIds.has(id)) ?? null;
  const chapterVocabulary = await getChapterVocabularyProgress({
    studentId,
    assignmentId: assignment.id,
    completedLessons: uniqueOrderedLessonIds
      .filter((lessonId) => completedLessonIds.has(lessonId))
      .map((lessonId) => ({
        lessonId,
        chunkIndex:
          passages?.find((passage) => passage.lesson_id === lessonId)?.chunk_index ?? null,
      })),
  });
  const vocabularyCheckpointsCompleted = chapterVocabulary.introducedCount;
  const requiredVocabularyCheckpoints = chapterVocabulary.requiredCount;
  const readingComplete =
    uniqueOrderedLessonIds.length > 0 && completedReadingCount >= uniqueOrderedLessonIds.length;
  const vocabularyDue = readingComplete && chapterVocabulary.pendingCount > 0;
  const isComplete = readingComplete && !vocabularyDue;

  if (isComplete && assignment.status !== "completed") {
    await supabase
      .from("reading_assignments")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", assignment.id)
      .eq("student_id", studentId);
  } else if (!isComplete && assignment.status === "assigned" && completedReadingCount > 0) {
    await supabase
      .from("reading_assignments")
      .update({ status: "in_progress" })
      .eq("id", assignment.id)
      .eq("student_id", studentId);
  }

  const chapterTitle = chapterLabel(
    chapterIndex,
    (passages ?? []).find((passage) => passage.chapter_title)?.chapter_title ?? null,
  );

  return {
    assignmentId: assignment.id,
    sourceDocumentId: assignment.source_document_id,
    bookTitle: source.title,
    chapterIndex,
    chapterTitle,
    status: isComplete ? "completed" : completedReadingCount > 0 ? "in_progress" : "assigned",
    action: isComplete ? "completed" : vocabularyDue ? "vocabulary" : "reading",
    nextLessonId: nextLessonId,
    completedReadingCount,
    totalReadingCount: uniqueOrderedLessonIds.length,
    vocabularyCheckpointsCompleted,
    requiredVocabularyCheckpoints,
    pendingVocabularyCount: chapterVocabulary.pendingCount,
    progressPercent: Math.round(
      ((completedReadingCount + Math.min(vocabularyCheckpointsCompleted, requiredVocabularyCheckpoints)) /
        Math.max(uniqueOrderedLessonIds.length + requiredVocabularyCheckpoints, 1)) *
        100,
    ),
  };
}

export async function completeGuidedVocabularyCheckpoint(params: {
  studentId: string;
  assignmentId: string;
}) {
  await refreshChapterVocabularyCheckpoint(params);
}
