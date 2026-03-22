import { requireAdmin } from '@/lib/auth/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CreateStudentForm } from '@/components/admin/CreateStudentForm';
import { StudentsTable } from '@/components/admin/StudentsTable';
import { AdminShell } from '@/components/admin/AdminShell';

export default async function AdminStudentsPage() {
  await requireAdmin();

  const supabase = createServerSupabaseClient();

  const { data: students, error: studentsError } = await supabase
    .from('students')
    .select('*')
    .order('created_at', { ascending: false });

  if (studentsError) {
    throw new Error(studentsError.message);
  }

  const { data: bookProgress, error: progressError } = await supabase
    .from('student_book_progress')
    .select('*');

  if (progressError) {
    throw new Error(progressError.message);
  }

  return (
    <AdminShell title="Students" subtitle="Manage student accounts and progress">
      <CreateStudentForm />
      <StudentsTable
        students={(students ?? []) as any}
        bookProgress={(bookProgress ?? []) as any}
      />
    </AdminShell>
  );
}