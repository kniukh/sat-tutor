import { createServerSupabaseClient } from "@/lib/supabase/server";

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

  const { data: vocabItems, error: vocabError } = await supabase
    .from("vocabulary_item_details")
    .select("id")
    .eq("student_id", studentId)
    .eq("is_removed", false)
    .in("lesson_id", uniqueOrderedLessonIds.length > 0 ? uniqueOrderedLessonIds : ["00000000-0000-0000-0000-000000000000"]);

  if (vocabError) throw vocabError;

  const hasChapterVocabulary = (vocabItems ?? []).length > 0;
  const vocabularyCheckpointsCompleted = Math.max(
    0,
    Number(assignment.vocabulary_checkpoints_completed ?? 0),
  );
  const requiredVocabularyCheckpoints = hasChapterVocabulary
    ? Math.floor(completedReadingCount / 2)
    : 0;
  const vocabularyDue =
    vocabularyCheckpointsCompleted < requiredVocabularyCheckpoints;
  const readingComplete =
    uniqueOrderedLessonIds.length > 0 && completedReadingCount >= uniqueOrderedLessonIds.length;
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
  const supabase = await createServerSupabaseClient();
  const { data: assignment, error } = await supabase
    .from("reading_assignments")
    .select("id, source_document_id, chapter_index, status, vocabulary_checkpoints_completed")
    .eq("id", params.assignmentId)
    .eq("student_id", params.studentId)
    .maybeSingle<AssignmentRow>();

  if (error) throw error;
  if (!assignment || assignment.chapter_index === null || assignment.status === "archived") {
    return;
  }

  const nextCount = Number(assignment.vocabulary_checkpoints_completed ?? 0) + 1;
  await supabase
    .from("reading_assignments")
    .update({
      vocabulary_checkpoints_completed: nextCount,
      status: assignment.status === "assigned" ? "in_progress" : assignment.status,
    })
    .eq("id", assignment.id)
    .eq("student_id", params.studentId);
}
