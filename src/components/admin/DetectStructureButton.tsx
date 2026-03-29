'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function DetectStructureButton({
  sourceDocumentId,
}: {
  sourceDocumentId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onClick() {
    setError(null);

    startTransition(async () => {
      const response = await fetch('/api/admin/sources/detect-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceDocumentId }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        setError(json?.error ?? 'Failed to detect structure');
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-slate-900 disabled:opacity-50"
      >
        {isPending ? 'Detecting...' : 'Detect Structure'}
      </button>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
