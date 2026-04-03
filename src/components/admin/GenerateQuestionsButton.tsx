'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function GenerateQuestionsButton({
  lessonId,
}: {
  lessonId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onClick() {
    setError(null);

    startTransition(async () => {
      const response = await fetch('/api/admin/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        setError(json?.error ?? 'Failed to generate questions');
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
        className="primary-button disabled:opacity-50"
      >
        {isPending ? 'Generating...' : 'Generate Questions'}
      </button>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
