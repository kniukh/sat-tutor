'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function GeneratePassagesButton({
  sourceId,
}: {
  sourceId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onClick() {
    setError(null);

    startTransition(async () => {
      const response = await fetch('/api/admin/generate-passages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        setError(json?.error ?? 'Failed to generate passages');
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className="rounded-xl bg-slate-900 px-5 py-3 text-white disabled:opacity-50"
      >
        {isPending ? 'Generating...' : 'Generate Passages'}
      </button>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}