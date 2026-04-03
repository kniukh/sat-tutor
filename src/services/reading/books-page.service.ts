import { createServerSupabaseClient } from "@/lib/supabase/server";

export type StudentBooksListItem = {
  sourceDocumentId: string;
  title: string;
  author: string | null;
  coverImagePath: string | null;
  progressPercent: number;
  completedLessonsCount: number;
  totalLessonsCount: number;
  currentLessonId: string | null;
  lastOpenedAt: string | null;
  isCurrent: boolean;
};

export type BooksPageData = {
  student: {
    id: string;
    fullName: string;
    accessCode: string;
  };
  featuredBook: StudentBooksListItem | null;
  books: StudentBooksListItem[];
};

type StudentRow = {
  id: string;
  full_name: string;
  access_code: string;
};

type StudentBookProgressRow = {
  source_document_id: string;
  current_lesson_id: string | null;
  last_opened_at: string | null;
  completed_lessons_count: number | null;
  total_lessons_count: number | null;
  progress_percent: number | null;
};

type GeneratedPassageRow = {
  source_document_id: string | null;
  lesson_id: string | null;
};

type LessonRow = {
  id: string;
  status: string | null;
  is_active: boolean | null;
};

type SourceDocumentRow = {
  id: string;
  title: string;
  author: string | null;
  metadata: Record<string, unknown> | null;
};

function getBookSortCategory(book: StudentBooksListItem, featuredId: string | null) {
  if (book.sourceDocumentId === featuredId) {
    return 0;
  }

  if (book.progressPercent > 0 && book.progressPercent < 100) {
    return 1;
  }

  return 2;
}

function pickFeaturedBookId(progressRows: StudentBookProgressRow[]) {
  const currentRow = progressRows.find((row) => Boolean(row.current_lesson_id));
  if (currentRow?.source_document_id) {
    return currentRow.source_document_id;
  }

  const lastOpenedRow = progressRows.find((row) => Boolean(row.last_opened_at));
  if (lastOpenedRow?.source_document_id) {
    return lastOpenedRow.source_document_id;
  }

  return null;
}

export async function getBooksPageData(accessCode: string): Promise<BooksPageData> {
  const supabase = await createServerSupabaseClient();

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, full_name, access_code")
    .eq("access_code", accessCode)
    .eq("is_active", true)
    .single<StudentRow>();

  if (studentError || !student) {
    throw new Error("Student not found");
  }

  const { data: progressRows, error: progressError } = await supabase
    .from("student_book_progress")
    .select(
      "source_document_id, current_lesson_id, last_opened_at, completed_lessons_count, total_lessons_count, progress_percent"
    )
    .eq("student_id", student.id)
    .order("last_opened_at", { ascending: false })
    .returns<StudentBookProgressRow[]>();

  if (progressError) {
    throw new Error(progressError.message);
  }

  const { data: generatedPassages, error: generatedPassagesError } = await supabase
    .from("generated_passages")
    .select("source_document_id, lesson_id")
    .not("lesson_id", "is", null)
    .returns<GeneratedPassageRow[]>();

  if (generatedPassagesError) {
    throw new Error(generatedPassagesError.message);
  }

  const uniqueLessonIds = Array.from(
    new Set(
      (generatedPassages ?? [])
        .map((row) => row.lesson_id)
        .filter((lessonId): lessonId is string => Boolean(lessonId))
    )
  );

  let validLessonIds = new Set<string>();

  if (uniqueLessonIds.length > 0) {
    const { data: lessons, error: lessonsError } = await supabase
      .from("lessons")
      .select("id, status, is_active")
      .in("id", uniqueLessonIds)
      .returns<LessonRow[]>();

    if (lessonsError) {
      throw new Error(lessonsError.message);
    }

    validLessonIds = new Set(
      (lessons ?? [])
        .filter((lesson) => lesson.is_active && lesson.status === "published")
        .map((lesson) => lesson.id)
    );
  }

  const lessonsByBook = new Map<string, Set<string>>();

  for (const row of generatedPassages ?? []) {
    if (!row.source_document_id || !row.lesson_id || !validLessonIds.has(row.lesson_id)) {
      continue;
    }

    const existing = lessonsByBook.get(row.source_document_id) ?? new Set<string>();
    existing.add(row.lesson_id);
    lessonsByBook.set(row.source_document_id, existing);
  }

  const { data: sourceDocuments, error: sourceDocumentsError } = await supabase
    .from("source_documents")
    .select("id, title, author, metadata")
    .eq("source_type", "book")
    .returns<SourceDocumentRow[]>();

  if (sourceDocumentsError) {
    throw new Error(sourceDocumentsError.message);
  }

  const sourceDocumentMap = new Map((sourceDocuments ?? []).map((row) => [row.id, row]));
  const progressMap = new Map((progressRows ?? []).map((row) => [row.source_document_id, row]));
  const featuredId = pickFeaturedBookId(progressRows ?? []);

  const books = (sourceDocuments ?? [])
    .map((sourceDocument) => {
      const sourceDocumentId = sourceDocument.id;
      const progressRow = progressMap.get(sourceDocumentId);
      const totalLessonsCount = lessonsByBook.get(sourceDocumentId)?.size ?? 0;
      const completedLessonsCount = progressRow?.completed_lessons_count ?? 0;
      const progressPercent =
        progressRow?.progress_percent ??
        (totalLessonsCount > 0
          ? Number(((completedLessonsCount / totalLessonsCount) * 100).toFixed(2))
          : 0);
      const metadata =
        sourceDocument.metadata && typeof sourceDocument.metadata === "object"
          ? sourceDocument.metadata
          : null;
      const coverImagePath =
        metadata && typeof metadata.cover_image_path === "string"
          ? metadata.cover_image_path
          : null;

      return {
        sourceDocumentId,
        title: sourceDocument.title,
        author: sourceDocument.author,
        coverImagePath,
        progressPercent,
        completedLessonsCount,
        totalLessonsCount,
        currentLessonId: progressRow?.current_lesson_id ?? null,
        lastOpenedAt: progressRow?.last_opened_at ?? null,
        isCurrent: sourceDocumentId === featuredId,
      } satisfies StudentBooksListItem;
    })
    .sort((a, b) => {
      const categoryDiff =
        getBookSortCategory(a, featuredId) - getBookSortCategory(b, featuredId);

      if (categoryDiff !== 0) {
        return categoryDiff;
      }

      const aTime = a.lastOpenedAt ? new Date(a.lastOpenedAt).getTime() : 0;
      const bTime = b.lastOpenedAt ? new Date(b.lastOpenedAt).getTime() : 0;

      if (aTime !== bTime) {
        return bTime - aTime;
      }

      return a.title.localeCompare(b.title);
    });

  return {
    student: {
      id: student.id,
      fullName: student.full_name,
      accessCode: student.access_code,
    },
    featuredBook: books.find((book) => book.sourceDocumentId === featuredId) ?? books[0] ?? null,
    books,
  };
}
