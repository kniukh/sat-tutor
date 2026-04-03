'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function QuestionReviewActions({
  questionId,
  reviewStatus,
}: {
  questionId: string;
  reviewStatus: 'draft' | 'approved' | 'rejected';
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateStatus(nextStatus: 'approved' | 'rejected' | 'draft') {
    setError(null);

    startTransition(async () => {
      const response = await fetch('/api/admin/questions/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          reviewStatus: nextStatus,
        }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        setError(json?.error ?? 'Failed to update question');
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="mt-4 space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => updateStatus('approved')}
          className="primary-button disabled:opacity-50"
        >
          Approve
        </button>

        <button
          type="button"
          disabled={isPending}
          onClick={() => updateStatus('rejected')}
          className="secondary-button disabled:opacity-50"
        >
          Reject
        </button>

        <button
          type="button"
          disabled={isPending}
          onClick={() => updateStatus('draft')}
          className="secondary-button disabled:opacity-50"
        >
          Reset to Draft
        </button>
      </div>

      <div className="token-text-muted text-sm">Review: {reviewStatus}</div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
