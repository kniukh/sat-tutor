'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function AddWritingPromptForm({
  lessonId,
}: {
  lessonId: string;
}) {
  const router = useRouter();
  const [promptText, setPromptText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const response = await fetch('/api/admin/writing-prompts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, promptText }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        setError(json?.error ?? 'Failed to create writing prompt');
        return;
      }

      setPromptText('');
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border bg-white p-6">
      <h2 className="text-xl font-semibold text-slate-900">Add Writing Prompt</h2>

      <textarea
        value={promptText}
        onChange={(e) => setPromptText(e.target.value)}
        rows={4}
        placeholder="What is the main idea of this passage?"
        className="w-full rounded-xl border px-3 py-2 text-slate-900"
      />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={isPending || !promptText.trim()}
        className="rounded-xl bg-slate-900 px-5 py-3 text-white disabled:opacity-50"
      >
        {isPending ? 'Saving...' : 'Add Writing Prompt'}
      </button>
    </form>
  );
}
