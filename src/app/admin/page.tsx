import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminStatsGrid } from '@/components/admin/AdminStatsGrid';

export default async function AdminPage() {
  await requireAdmin();

  const supabase = await createServerSupabaseClient();;

  const [
    studentsResult,
    lessonsResult,
    publishedLessonsResult,
    sourcesResult,
    bookProgressResult,
  ] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }),
    supabase.from('lessons').select('*', { count: 'exact', head: true }),
    supabase
      .from('lessons')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published'),
    supabase.from('source_documents').select('*', { count: 'exact', head: true }),
    supabase.from('student_book_progress').select('progress_percent'),
  ]);

  if (studentsResult.error) throw new Error(studentsResult.error.message);
  if (lessonsResult.error) throw new Error(lessonsResult.error.message);
  if (publishedLessonsResult.error) {
    throw new Error(publishedLessonsResult.error.message);
  }
  if (sourcesResult.error) throw new Error(sourcesResult.error.message);
  if (bookProgressResult.error) throw new Error(bookProgressResult.error.message);

  const progressItems = bookProgressResult.data ?? [];
  const averageBookProgress =
    progressItems.length > 0
      ? progressItems.reduce(
          (sum, item) => sum + Number(item.progress_percent ?? 0),
          0,
        ) / progressItems.length
      : 0;

  const stats = [
    { label: 'Students', value: studentsResult.count ?? 0 },
    { label: 'Lessons', value: lessonsResult.count ?? 0 },
    { label: 'Published lessons', value: publishedLessonsResult.count ?? 0 },
    { label: 'Source documents', value: sourcesResult.count ?? 0 },
    { label: 'Avg. book progress', value: `${Math.round(averageBookProgress)}%` },
  ];

  return (
    <AdminShell title="Admin Dashboard" subtitle="Overview of the platform">
      <AdminStatsGrid items={stats} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Link
          href="/admin/lessons"
          className="rounded-2xl border bg-white p-5 hover:bg-slate-50"
        >
          <div className="font-semibold text-slate-900">Lessons</div>
          <div className="mt-2 text-sm text-slate-600">
            Create, edit, publish, and review lesson questions.
          </div>
        </Link>

        <Link
          href="/admin/sources"
          className="rounded-2xl border bg-white p-5 hover:bg-slate-50"
        >
          <div className="font-semibold text-slate-900">Sources</div>
          <div className="mt-2 text-sm text-slate-600">
            Upload books and generate passages for guided reading.
          </div>
        </Link>

        <Link
          href="/admin/students"
          className="rounded-2xl border bg-white p-5 hover:bg-slate-50"
        >
          <div className="font-semibold text-slate-900">Students</div>
          <div className="mt-2 text-sm text-slate-600">
            Manage students, access codes, languages, and progress.
          </div>
        </Link>

        <Link
          href="/admin/sources"
          className="rounded-2xl border bg-white p-5 hover:bg-slate-50"
        >
          <div className="font-semibold text-slate-900">AI Pipeline</div>
          <div className="mt-2 text-sm text-slate-600">
            Analyze passages, create lessons, and generate questions.
          </div>
        </Link>

        <Link
          href="/admin/vocabulary"
          className="rounded-2xl border bg-white p-5 hover:bg-slate-50"
        >
          <div className="font-semibold text-slate-900">Weekly Vocabulary</div>
          <div className="mt-2 text-sm text-slate-600">
            Manage weekly vocabulary drills and progress.
          </div>
        </Link>

        <Link
          href="/admin/skills"
          className="rounded-2xl border bg-white p-5 hover:bg-slate-50"
        >
          <div className="font-semibold text-slate-900">Skill Tracking</div>
          <div className="mt-2 text-sm text-slate-600">
            Monitor student skill development and analytics.
          </div>
        </Link>
      </div>
    </AdminShell>
  );
}
