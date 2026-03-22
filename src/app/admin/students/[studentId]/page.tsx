import { requireAdmin } from '@/lib/auth/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import EditStudentForm from '@/components/admin/EditStudentForm';
import { AdminShell } from '@/components/admin/AdminShell';
import StudentRecentLessons from '@/components/admin/StudentRecentLessons';
import StudentVocabularyHistory from '@/components/admin/StudentVocabularyHistory';
import StudentWritingHistory from '@/components/admin/StudentWritingHistory';

export default async function AdminStudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  await requireAdmin();

  const { studentId } = await params;
  const supabase = createServerSupabaseClient();

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