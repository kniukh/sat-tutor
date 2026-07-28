'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function SelectBookButton({
  studentId,
  sourceDocumentId,
  isCurrent,
}: {
  studentId: string;
  sourceDocumentId: string;
  isCurrent: boolean;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function selectBook() {
    setIsPending(true);
    const response = await fetch('/api/reading/select-book', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ studentId, sourceDocumentId }),
    });
    setIsPending(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      alert(payload?.error ?? 'Failed to select book');
      return;
    }

    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={selectBook}
      disabled={isPending || isCurrent}
      className={isCurrent ? 'secondary-button flex-1 opacity-70' : 'secondary-button flex-1'}
    >
      {isCurrent ? 'Selected' : isPending ? 'Selecting...' : 'Select Book'}
    </button>
  );
}
