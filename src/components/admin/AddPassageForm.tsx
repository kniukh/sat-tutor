'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function AddPassageForm({ lessonId }: { lessonId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [passageText, setPassageText] = useState('');
  const [displayOrder, setDisplayOrder] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const response = await fetch('/api/admin/passages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId,
          title,
          passageText,
          displayOrder,
        }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        setError(json?.error ?? 'Failed to add passage');
        return;
      }

      setTitle('');
      setPassageText('');
      setDisplayOrder(1);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border bg-white p-6">
      <h2 className="text-xl font-semibold text-slate-900">Add Passage</h2>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Passage title"
        className="w-full rounded-xl border px-3 py-2 text-slate-900"
      />

      <textarea
        value={passageText}
        onChange={(e) => setPassageText(e.target.value)}
        placeholder="Passage text"
        rows={8}
        className="w-full rounded-xl border px-3 py-2 text-slate-900"
      />

      <input
        type="number"
        value={displayOrder}
        onChange={(e) => setDisplayOrder(Number(e.target.value))}
        className="w-full rounded-xl border px-3 py-2 text-slate-900"
      />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={isPending || !passageText}
        className="rounded-xl bg-slate-900 px-5 py-3 text-white disabled:opacity-50"
      >
        {isPending ? 'Adding...' : 'Add Passage'}
      </button>
    </form>
  );
}