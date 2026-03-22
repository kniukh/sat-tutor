'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function CreateSourceForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [sourceType, setSourceType] = useState('book');
  const [rawText, setRawText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const response = await fetch('/api/admin/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          author,
          sourceType,
          rawText,
        }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        setError(json?.error ?? 'Failed to create source');
        return;
      }

      setTitle('');
      setAuthor('');
      setSourceType('book');
      setRawText('');
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border bg-white p-6">
      <h2 className="text-xl font-semibold text-slate-900">Create Source Document</h2>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="w-full rounded-xl border px-3 py-2 text-slate-900"
      />

      <input
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        placeholder="Author"
        className="w-full rounded-xl border px-3 py-2 text-slate-900"
      />

      <select
        value={sourceType}
        onChange={(e) => setSourceType(e.target.value)}
        className="w-full rounded-xl border px-3 py-2 text-slate-900"
      >
        <option value="book">book</option>
        <option value="article">article</option>
        <option value="essay">essay</option>
        <option value="story">story</option>
      </select>

      <textarea
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        placeholder="Paste full raw text here"
        rows={14}
        className="w-full rounded-xl border px-3 py-2 text-slate-900"
      />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={isPending || !title || !rawText}
        className="rounded-xl bg-slate-900 px-5 py-3 text-white disabled:opacity-50"
      >
        {isPending ? 'Saving...' : 'Save Source'}
      </button>
    </form>
  );
}