'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function PrepareVocabularyDrillsButton({
  studentId,
}: {
  studentId: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onPrepare() {
    setMessage(null);

    startTransition(async () => {
      const response = await fetch('/api/vocabulary/prepare-drills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage(json?.error ?? 'Failed to prepare drills');
        return;
      }

      setMessage(`Prepared ${json?.count ?? 0} drill items`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onPrepare}
        disabled={isPending}
        className="rounded-xl bg-slate-900 px-5 py-3 text-white disabled:opacity-50"
      >
        {isPending ? 'Preparing...' : 'Prepare Vocabulary Drills'}
      </button>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}