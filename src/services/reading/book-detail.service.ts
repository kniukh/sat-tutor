import { createServerSupabaseClient } from "@/lib/supabase/server";
import { studentLessonPath } from "@/lib/routes/student";

export type BookLessonListItem = {
  lessonId: string;
  name: string;
  lessonType: string | null;
  displayOrder: number | null;
  chapterIndex: number | null;
  chapterTitle: string | null;
  status: "completed" | "current" | "available";
  href: string;
};

export type BookChapterGroup = {
  chapterIndex: number | null;
  chapterTitle: string;
  lessons: BookLessonListItem[];
};

export type BookDetailData = {
  student: {
    id: string;
    accessCode: string;
  };
  book: {
    id: string;
    title: string;
    author: string | null;
    coverImagePath: string | null;
  };
  progress: {
    progressPercent: number;
    completedLessonsCount: number;
    totalLessonsCount: number;
    currentLessonId: string | null;
    lastOpenedAt: string | null;
  } | null;
  continueLessonHref: string | null;
  chapters: BookChapterGroup[];
};

type StudentRow = {
  id: string;
  access_code: string;
};

type SourceDocumentRow = {
  id: string;
  title: string;
  author: string | null;
  metadata: Record<string, unknown> | null;
};

type StudentBookProgressRow = {
  current_lesson_id: string | null;
  last_opened_at: string | null;
  completed_lessons_count: number | null;
  total_lessons_count: number | null;
  progress_percent: number | null;
};

type GeneratedPassageRow = {
  source_document_id: string;
  lesson_id: string | null;
  chapter_index: number | null;
  chapter_title: string | null;
  chunk_index: number | null;
};

type LessonRow = {
  id: string;
  name: string;
  lesson_type: string | null;
  display_order: number | null;
  status: string | null;
  is_active: boolean | null;
};

type LessonAttemptRow = {
  lesson_id: string;
};

type LessonCandidate = {
  lessonId: string;
  name: string;
  lessonType: string | null;
  displayOrder: number | null;
  chapterIndex: number | null;
  chapterTitle: string | null;
  chunkIndex: number | null;
};

function normalizeChapterTitle(chapterIndex: number | null, chapterTitle: string | null) {
  if (chapterTitle && chapterTitle.trim().length > 0) {
    return chapterTitle;
  }

  if (chapterIndex !== null) {
    return `Chapter ${chapterIndex}`;
  }

  return "Unassigned Chapter";
}

function getChapterSortValue(chapterIndex: number | null) {
  return chapterIndex ?? Number.MAX_SAFE_INTEGER;
}

function getDisplayOrderSortValue(displayOrder: number | null) {
  return displayOrder ?? Number.MAX_SAFE_INTEGER;
}

export async function getBookDetailData(params: {
  accessCode: string;
  sourceDocumentId: string;
}): Promise<BookDetailData> {
  const supabase = await createServerSupabaseClient();

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, access_code")
    .eq("access_code", params.accessCode)
    .eq("is_active", true)
    .single<StudentRow>();

  if (studentError || !student) {
    throw new Error("Student not found");
  }

  const { data: book, error: bookError } = await supabase
    .from("source_documents")
    .select("id, title, author, metadata")
    .eq("id", params.sourceDocumentId)
    .single<SourceDocumentRow>();

  if (bookError || !book) {
    throw new Error("Book not found");
  }

  const bookMetadata =
    book.metadata && typeof book.metadata === "object" ? book.metadata : null;
  const coverImagePath =
    bookMetadata && typeof bookMetadata.cover_image_path === "string"
      ? bookMetadata.cover_image_path
      : null;

  const { data: progressRow, error: progressError } = await supabase
    .from("student_book_progress")
    .select(
      "current_lesson_id, last_opened_at, completed_lessons_count, total_lessons_count, progress_percent"
    )
    .eq("student_id", student.id)
    .eq("source_document_id", params.sourceDocumentId)
    .maybeSingle<StudentBookProgressRow>();

  if (progressError) {
    throw new Error(progressError.message);
  }

  const { data: generatedPassages, error: generatedPassagesError } = await supabase
    .from("generated_passages")
    .select("source_document_id, lesson_id, chapter_index, chapter_title, chunk_index")
    .eq("source_document_id", params.sourceDocumentId)
    .not("lesson_id", "is", null)
    .order("chapter_index", { ascending: true })
    .order("chunk_index", { ascending: true })
    .returns<GeneratedPassageRow[]>();

  if (generatedPassagesError) {
    throw new Error(generatedPassagesError.message);
  }

  const lessonIds = Array.from(
    new Set(
      (generatedPassages ?? [])
        .map((row) => row.lesson_id)
        .filter((lessonId): lessonId is string => Boolean(lessonId))
    )
  );

  let lessons: LessonRow[] = [];

  if (lessonIds.length > 0) {
    const { data, error } = await supabase
      .from("lessons")
      .select("id, name, lesson_type, display_order, status, is_active")
      .in("id", lessonIds)
      .returns<LessonRow[]>();

    if (error) {
      throw new Error(error.message);
    }

    lessons = data ?? [];
  }

  const lessonMap = new Map(
    lessons
      .filter((lesson) => lesson.is_active && lesson.status === "published")
      .map((lesson) => [lesson.id, lesson])
  );

  const validLessonIds = Array.from(lessonMap.keys());
  let completedLessonIds = new Set<string>();

  if (validLessonIds.length > 0) {
    const { data, error } = await supabase
      .from("lesson_attempts")
      .select("lesson_id")
      .eq("student_id", student.id)
      .in("lesson_id", validLessonIds)
      .returns<LessonAttemptRow[]>();

    if (error) {
      throw new Error(error.message);
    }

    completedLessonIds = new Set((data ?? []).map((row) => row.lesson_id));
  }

  const sortedCandidates = (generatedPassages ?? [])
    .map((row) => {
      if (!row.lesson_id) {
        return null;
      }

      const lesson = lessonMap.get(row.lesson_id);
      if (!lesson) {
        return null;
      }

      return {
        lessonId: lesson.id,
        name: lesson.name,
        lessonType: lesson.lesson_type,
        displayOrder: lesson.display_order,
        chapterIndex: row.chapter_index,
        chapterTitle: row.chapter_title,
        chunkIndex: row.chunk_index,
      } satisfies LessonCandidate;
    })
    .filter((item): item is LessonCandidate => Boolean(item))
    .sort((a, b) => {
      const chapterDiff =
        getChapterSortValue(a.chapterIndex) - getChapterSortValue(b.chapterIndex);
      if (chapterDiff !== 0) {
        return chapterDiff;
      }

      const displayOrderDiff =
        getDisplayOrderSortValue(a.displayOrder) - getDisplayOrderSortValue(b.displayOrder);
      if (displayOrderDiff !== 0) {
        return displayOrderDiff;
      }

      return (a.chunkIndex ?? Number.MAX_SAFE_INTEGER) - (b.chunkIndex ?? Number.MAX_SAFE_INTEGER);
    });

  const dedupedLessons: BookLessonListItem[] = [];
  const seenLessonIds = new Set<string>();

  for (const item of sortedCandidates) {
    if (seenLessonIds.has(item.lessonId)) {
      continue;
    }

    seenLessonIds.add(item.lessonId);

    const status: BookLessonListItem["status"] =
      progressRow?.current_lesson_id === item.lessonId
        ? "current"
        : completedLessonIds.has(item.lessonId)
          ? "completed"
          : "available";

    dedupedLessons.push({
      lessonId: item.lessonId,
      name: item.name,
      lessonType: item.lessonType,
      displayOrder: item.displayOrder,
      chapterIndex: item.chapterIndex,
      chapterTitle: item.chapterTitle,
      status,
      href: studentLessonPath(item.lessonId),
    });
  }

  const chapterMap = new Map<string, BookChapterGroup>();

  for (const lesson of dedupedLessons) {
    const key = `${lesson.chapterIndex ?? "none"}::${lesson.chapterTitle ?? ""}`;

    if (!chapterMap.has(key)) {
      chapterMap.set(key, {
        chapterIndex: lesson.chapterIndex,
        chapterTitle: normalizeChapterTitle(lesson.chapterIndex, lesson.chapterTitle),
        lessons: [],
      });
    }

    chapterMap.get(key)?.lessons.push(lesson);
  }

  const chapters = Array.from(chapterMap.values()).sort((a, b) => {
    const chapterDiff = getChapterSortValue(a.chapterIndex) - getChapterSortValue(b.chapterIndex);
    if (chapterDiff !== 0) {
      return chapterDiff;
    }

    return a.chapterTitle.localeCompare(b.chapterTitle);
  });

  const totalLessonsCount = dedupedLessons.length;
  const completedLessonsCount = completedLessonIds.size;
  const progress =
    totalLessonsCount > 0 || progressRow
      ? {
          progressPercent:
            progressRow?.progress_percent ??
            (totalLessonsCount > 0
              ? Number(((completedLessonsCount / totalLessonsCount) * 100).toFixed(2))
              : 0),
          completedLessonsCount:
            progressRow?.completed_lessons_count ?? completedLessonsCount,
          totalLessonsCount:
            progressRow?.total_lessons_count ?? totalLessonsCount,
          currentLessonId: progressRow?.current_lesson_id ?? null,
          lastOpenedAt: progressRow?.last_opened_at ?? null,
        }
      : null;

  return {
    student: {
      id: student.id,
      accessCode: student.access_code,
    },
    book: {
      id: book.id,
      title: book.title,
      author: book.author,
      coverImagePath,
    },
    progress,
    continueLessonHref: progress?.currentLessonId
      ? studentLessonPath(progress.currentLessonId)
      : null,
    chapters,
  };
}
