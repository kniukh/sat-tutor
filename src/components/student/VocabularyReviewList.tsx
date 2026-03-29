'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type WordItem = {
  id: string;
  word: string;
  status: string;
  times_seen: number;
  times_correct: number;
  times_wrong: number;
  next_review_date: string | null;
};

export default function VocabularyReviewList({
  words,
}: {
  words: WordItem[];
}) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  async function reviewWord(
    wordProgressId: string,
    result: 'correct' | 'wrong',
    word: string,
  ) {
    setActiveId(wordProgressId);
    setMessage(null);

    const response = await fetch('/api/vocabulary/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wordProgressId, result }),
    });

    const json = await response.json().catch(() => null);

    if (!response.ok) {
      setMessage(json?.error ?? 'Review failed');
      setActiveId(null);
      return;
    }

    setMessage(`Updated: ${word} → ${result}`);
    setActiveId(null);
    router.refresh();
  }

  if (words.length === 0) {
    return <p className="text-slate-600">No vocabulary words yet.</p>;
  }

  return (
    <div className="space-y-3">
      {message ? (
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      {words.map((word) => (
        <div
          key={word.id}
          className="rounded-xl border border-slate-200 bg-white p-4"
        >
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="font-semibold text-slate-900">{word.word}</div>
            <div className="text-sm text-slate-600">
              Next review: {word.next_review_date ?? 'Not set'}
            </div>
          </div>

          <div className="mt-2 text-sm text-slate-600">
            Status: {word.status} · Seen: {word.times_seen} · Correct:{' '}
            {word.times_correct} · Wrong: {word.times_wrong}
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              disabled={isPending && activeId === word.id}
              onClick={() =>
                startTransition(() => reviewWord(word.id, 'correct', word.word))
              }
              className="rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
            >
              {isPending && activeId === word.id ? 'Saving...' : 'I knew it'}
            </button>

            <button
              type="button"
              disabled={isPending && activeId === word.id}
              onClick={() =>
                startTransition(() => reviewWord(word.id, 'wrong', word.word))
              }
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-900 disabled:opacity-50"
            >
              {isPending && activeId === word.id ? 'Saving...' : 'Still hard'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
