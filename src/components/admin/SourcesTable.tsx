'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type SourceItem = {
  id: string;
  title: string;
  author: string | null;
  source_type: string;
  upload_kind: string | null;
  pdf_processing_status: string | null;
  content_mode?: 'sat' | 'det' | null;
};

export function SourcesTable({ sources }: { sources: SourceItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<'all' | 'sat' | 'det'>('all');
  const filteredSources = useMemo(() => mode === 'all' ? sources : sources.filter((source) => (source.content_mode ?? 'sat') === mode), [mode, sources]);

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
    <section className="card-surface p-6">
      <div className="app-kicker">Saved Sources</div>
      <h2 className="token-text-primary mt-1 text-2xl font-semibold tracking-[-0.02em]">Content library</h2>
      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Filter by reading mode">
        {(['all', 'sat', 'det'] as const).map((value) => (
          <button key={value} type="button" onClick={() => setMode(value)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase ${mode === value ? 'border-slate-900 bg-slate-900 text-white' : 'border-line bg-white text-slate-700'}`}>
            {value}
          </button>
        ))}
      </div>

      {!filteredSources || filteredSources.length === 0 ? (
        <p className="token-text-secondary">No source documents yet.</p>
      ) : (
        <div className="space-y-3">
          {filteredSources.map((source) => (
            <div key={source.id} className="surface-soft-panel flex items-center justify-between rounded-[1.25rem] p-4 transition-colors hover:bg-[var(--color-surface)]">
              <Link
                href={`/admin/sources/${source.id}`}
                className="flex-1"
              >
                <div className="token-text-primary font-semibold">{source.title}</div>
                <div className="token-text-secondary mt-1 text-sm">
                  {source.author || 'Unknown author'} · {source.source_type} · {(source.content_mode ?? 'sat').toUpperCase()}
                </div>
                <div className="token-text-muted mt-1 text-sm">
                  Upload: {source.upload_kind ?? 'raw_text'} · Status:{' '}
                  {source.pdf_processing_status ?? 'uploaded'}
                </div>
              </Link>
              <button
                type="button"
                disabled={isPending}
                onClick={() => deleteSource(source.id)}
                className="ml-4 rounded-[1rem] bg-red-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
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
