'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  sourceId: string;
};

export default function RefreshCoverButton({ sourceId }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRefresh() {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const response = await fetch('/api/admin/sources', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceId,
          action: 'refresh_cover',
        }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        setError(json?.error ?? 'Failed to refresh cover');
        return;
      }

      setMessage(json?.coverImagePath ? 'Cover refreshed.' : 'No cover found.');
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleRefresh}
        disabled={isPending}
        className="secondary-button min-h-11 w-full"
      >
        {isPending ? 'Refreshing...' : 'Refresh Cover'}
      </button>

      {error ? <div className="text-sm text-rose-600">{error}</div> : null}
      {message ? <div className="text-sm text-emerald-600">{message}</div> : null}
    </div>
  );
}
