import { requireAdmin } from '@/lib/auth/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { AdminShell } from '@/components/admin/AdminShell';
import { CreateSourceForm } from '@/components/admin/CreateSourceForm';
import UploadPdfSourceForm from '@/components/admin/UploadPdfSourceForm';
import { SourcesTable } from '@/components/admin/SourcesTable';

export default async function AdminSourcesPage() {
  await requireAdmin();

  const supabase = await createServerSupabaseClient();

  const { data: sources, error } = await supabase
    .from('source_documents')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (
    <AdminShell
      title="Source Documents"
      subtitle="Upload raw text and PDF books for AI content generation"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <CreateSourceForm />
        <UploadPdfSourceForm />
      </div>

      <SourcesTable sources={(sources ?? []) as any} />
    </AdminShell>
  );
}
