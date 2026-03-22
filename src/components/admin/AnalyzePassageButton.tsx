'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function AnalyzePassageButton({
  generatedPassageId,
}: {
  generatedPassageId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onClick() {
    setError(null);

    startTransition(async () => {
      const response = await fetch('/api/admin/analyze-passage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generatedPassageId }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        setError(json?.error ?? 'Failed to analyze passage');
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
        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-900 disabled:opacity-50"
      >
        {isPending ? 'Analyzing...' : 'Analyze Passage'}
      </button>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}