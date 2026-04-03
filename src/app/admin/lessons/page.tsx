import { requireAdmin } from '@/lib/auth/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CreateLessonForm } from '@/components/admin/CreateLessonForm';
import { LessonsTable } from '@/components/admin/LessonsTable';
import { AdminShell } from '@/components/admin/AdminShell';

export default async function AdminLessonsPage() {
  await requireAdmin();

  const supabase = await createServerSupabaseClient();

  const { data: lessons, error } = await supabase
    .from('lessons')
    .select('id, name, slug, lesson_type, status')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (
    <AdminShell title="Lessons" subtitle="Create and manage lessons">
      <CreateLessonForm />
      <LessonsTable lessons={(lessons ?? []) as any} />
    </AdminShell>
  );
}
