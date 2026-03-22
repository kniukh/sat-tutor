'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type SourceItem = {
  id: string;
  title: string;
  author: string | null;
  source_type: string;
  upload_kind: string | null;
  pdf_processing_status: string | null;
};

export function SourcesTable({ sources }: { sources: SourceItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function deleteSource(id: string) {
    if (!confirm('Are you sure you want to delete this source?')) {
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/admin/sources?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        alert('Failed to delete source');
        return;
      }

      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border bg-white p-6">
      <h2 className="mb-4 text-xl font-semibold text-slate-900">Saved sources</h2>

      {!sources || sources.length === 0 ? (
        <p className="text-slate-600">No source documents yet.</p>
      ) : (
        <div className="space-y-3">
          {sources.map((source) => (
            <div key={source.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-4 hover:bg-slate-50">
              <Link
                href={`/admin/sources/${source.id}`}
                className="flex-1"
              >
                <div className="font-semibold text-slate-900">{source.title}</div>
                <div className="mt-1 text-sm text-slate-600">
                  {source.author || 'Unknown author'} · {source.source_type}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  Upload: {source.upload_kind ?? 'raw_text'} · Status:{' '}
                  {source.pdf_processing_status ?? 'uploaded'}
                </div>
              </Link>
              <button
                type="button"
                disabled={isPending}
                onClick={() => deleteSource(source.id)}
                className="ml-4 rounded-xl bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}