import { requireAdmin } from '@/lib/auth/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminStatsGrid } from '@/components/admin/AdminStatsGrid';

export default async function AdminDetInsightsPage() {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();
  const [{ count: books }, { count: lessons }, { count: assignments }, { data: metrics }] = await Promise.all([
    supabase.from('source_documents').select('id', { count: 'exact', head: true }).eq('content_mode', 'det').eq('source_type', 'book'),
    supabase.from('lessons').select('id', { count: 'exact', head: true }).eq('content_mode', 'det'),
    supabase.from('reading_assignments').select('id', { count: 'exact', head: true }).in('source_document_id', (await supabase.from('source_documents').select('id').eq('content_mode', 'det')).data?.map((row) => row.id) ?? []),
    supabase.from('lesson_reading_metrics').select('words_per_minute, reading_duration_sec').eq('content_mode', 'det'),
  ]);
  const averageWpm = metrics?.length ? Math.round(metrics.reduce((sum, row) => sum + Number(row.words_per_minute ?? 0), 0) / metrics.length) : 0;
  const totalMinutes = Math.round((metrics ?? []).reduce((sum, row) => sum + Number(row.reading_duration_sec ?? 0), 0) / 60);
  return <AdminShell title="DET Insights" subtitle="DET content, assignment, and reading speed signals."><AdminStatsGrid items={[{ label: 'DET Books', value: books ?? 0 }, { label: 'DET Lessons', value: lessons ?? 0 }, { label: 'Assignments', value: assignments ?? 0 }, { label: 'Average WPM', value: averageWpm }, { label: 'Reading Minutes', value: totalMinutes }]} /></AdminShell>;
}
