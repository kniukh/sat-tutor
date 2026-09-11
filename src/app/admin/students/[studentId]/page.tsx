import { requireAdmin } from '@/lib/auth/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import EditStudentForm from '@/components/admin/EditStudentForm';
import { AdminShell } from '@/components/admin/AdminShell';
import StudentRecentLessons from '@/components/admin/StudentRecentLessons';
import StudentVocabularyHistory from '@/components/admin/StudentVocabularyHistory';
import StudentWritingHistory from '@/components/admin/StudentWritingHistory';
import AssignReadingBookForm from '@/components/admin/AssignReadingBookForm';

export default async function AdminStudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  await requireAdmin();

  const { studentId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('*')
    .eq('id', studentId)
    .single();

  if (studentError || !student) {
    throw new Error('Student not found');
  }

  const { data: bookProgress } = await supabase
    .from('student_book_progress')
    .select('*')
    .eq('student_id', student.id)
    .order('last_opened_at', { ascending: false });

  const { data: availableBooks } = await supabase
    .from('source_documents')
    .select('id, title, content_mode')
    .eq('source_type', 'book')
    .order('title', { ascending: true });

  const availableBookIds = (availableBooks ?? []).map((book) => book.id);
  const { data: bookChapters } = availableBookIds.length > 0
    ? await supabase
        .from('source_document_clean_text')
        .select('source_document_id, chapter_index, chapter_title')
        .in('source_document_id', availableBookIds)
        .order('chapter_index', { ascending: true })
    : { data: [] as any[] };
  const chaptersByBook = new Map<string, Array<{ chapter_index: number; chapter_title: string | null }>>();
  for (const chapter of bookChapters ?? []) {
    const items = chaptersByBook.get(chapter.source_document_id) ?? [];
    items.push({ chapter_index: Number(chapter.chapter_index), chapter_title: chapter.chapter_title ?? null });
    chaptersByBook.set(chapter.source_document_id, items);
  }
  const assignableBooks = (availableBooks ?? []).map((book) => ({
    ...book,
    chapters: chaptersByBook.get(book.id) ?? [],
  }));

  const { data: readingAssignments } = await supabase
    .from('reading_assignments')
    .select('id, source_document_id, chapter_index, status, vocabulary_checkpoints_completed, completed_at')
    .eq('student_id', student.id)
    .order('assigned_at', { ascending: false });
  const bookTitleById = new Map((availableBooks ?? []).map((book) => [book.id, book.title]));

  const { data: lessonAttempts, error: lessonAttemptsError } = await supabase
    .from('lesson_attempts')
    .select(`
      *,
      lessons (
        id,
        name,
        lesson_type
      )
    `)
    .eq('student_id', student.id)
    .order('created_at', { ascending: false })
    .limit(10);

  if (lessonAttemptsError) {
    throw new Error(lessonAttemptsError.message);
  }

  const { data: vocabularyItems, error: vocabularyError } = await supabase
    .from('vocabulary_item_details')
    .select('*')
    .eq('student_id', student.id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (vocabularyError) {
    throw new Error(vocabularyError.message);
  }

  const { data: writingSubmissions, error: writingError } = await supabase
    .from('student_writing_submissions')
    .select(`
      *,
      lessons (
        id,
        name
      )
    `)
    .eq('student_id', student.id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (writingError) {
    throw new Error(writingError.message);
  }

  return (
    <AdminShell title={student.full_name} subtitle="Student settings and history">
      <EditStudentForm student={student} />

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Book Progress</h2>
        {availableBooks && availableBooks.length > 0 ? (
          <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 text-sm font-semibold text-slate-900">Assign reading chapter</div>
            <AssignReadingBookForm studentId={student.id} books={assignableBooks} />
          </div>
        ) : null}

        {readingAssignments && readingAssignments.length > 0 ? (
          <div className="mb-5 space-y-2">
            <div className="text-sm font-semibold text-slate-900">Guided chapter assignments</div>
            {readingAssignments.map((assignment: any) => (
              <div key={assignment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm">
                <div>
                  <div className="font-semibold text-slate-900">
                    {bookTitleById.get(assignment.source_document_id) ?? 'Reading book'} · Chapter {assignment.chapter_index ?? 'all'}
                  </div>
                  <div className="text-slate-500">
                    Vocabulary checkpoints: {assignment.vocabulary_checkpoints_completed ?? 0}
                  </div>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  {assignment.status}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {!bookProgress || bookProgress.length === 0 ? (
          <p className="text-slate-600">No book progress yet.</p>
        ) : (
          <div className="space-y-3">
            {bookProgress.map((item: any) => (
              <div key={item.id} className="rounded-xl border border-slate-200 p-4">
                <div className="text-slate-900">
                  Progress: {Math.round(Number(item.progress_percent))}%
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  Completed: {item.completed_lessons_count} / {item.total_lessons_count}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <StudentRecentLessons items={(lessonAttempts ?? []) as any} />
        <StudentVocabularyHistory items={(vocabularyItems ?? []) as any} />
      </div>

      <StudentWritingHistory items={(writingSubmissions ?? []) as any} />
    </AdminShell>
  );
}
