'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type VocabItem = {
  id: string;
  item_text: string;
  item_type: 'word' | 'phrase';
  english_explanation: string | null;
  translated_explanation: string | null;
  translation_language: string;
  example_text: string | null;
  is_understood?: boolean;
};

export default function VocabularyReviewCards({
  items,
}: {
  items: VocabItem[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'all' | 'word' | 'phrase'>('all');
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredItems = useMemo(() => {
    if (tab === 'all') return items;
    return items.filter((item) => item.item_type === tab);
  }, [items, tab]);

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage('Copied');
    } catch {
      setMessage('Copy failed');
    }
  }

  function markUnderstood(vocabularyItemId: string, isUnderstood: boolean) {
    setMessage(null);

    startTransition(async () => {
      const response = await fetch('/api/vocabulary/mark-understood', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vocabularyItemId, isUnderstood }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage(json?.error ?? 'Update failed');
        return;
      }

      setMessage(isUnderstood ? 'Marked as understood' : 'Marked as not understood');
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setTab('all')}
          className={`rounded-xl px-4 py-2 ${
            tab === 'all'
              ? 'bg-slate-900 text-white'
              : 'border border-slate-300 bg-white text-slate-900'
          }`}
        >
          All
        </button>

        <button
          type="button"
          onClick={() => setTab('word')}
          className={`rounded-xl px-4 py-2 ${
            tab === 'word'
              ? 'bg-slate-900 text-white'
              : 'border border-slate-300 bg-white text-slate-900'
          }`}
        >
          Words
        </button>

        <button
          type="button"
          onClick={() => setTab('phrase')}
          className={`rounded-xl px-4 py-2 ${
            tab === 'phrase'
              ? 'bg-slate-900 text-white'
              : 'border border-slate-300 bg-white text-slate-900'
          }`}
        >
          Phrases
        </button>
      </div>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}

      {filteredItems.length === 0 ? (
        <p className="text-slate-600">No vocabulary items in this tab.</p>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-slate-200 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-900">
                    {item.item_text}
                  </div>
                  <div className="text-sm text-slate-500">
                    {item.item_type} · {item.translation_language}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => copyText(item.item_text)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900"
                  >
                    Copy
                  </button>

                  {item.is_understood ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => markUnderstood(item.id, false)}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 disabled:opacity-50"
                    >
                      Not Understood
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => markUnderstood(item.id, true)}
                      className="rounded-xl bg-slate-900 px-3 py-2 text-white disabled:opacity-50"
                    >
                      Understood
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <div className="text-sm text-slate-700">
                  <span className="font-medium">English meaning:</span>{' '}
                  {item.english_explanation || '-'}
                </div>

                <div className="text-sm text-slate-700">
                  <span className="font-medium">Translation:</span>{' '}
                  {item.translated_explanation || '-'}
                </div>

                {item.example_text ? (
                  <div className="text-sm text-slate-600">
                    <span className="font-medium">Example:</span> {item.example_text}
                  </div>
                ) : null}

                <div className="text-sm text-slate-500">
                  Status: {item.is_understood ? 'understood' : 'review needed'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}