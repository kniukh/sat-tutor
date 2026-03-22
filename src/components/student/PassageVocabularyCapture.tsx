'use client';

import { useState, useTransition } from 'react';

type CaptureItem = {
  itemText: string;
  itemType: 'word' | 'phrase';
  contextText?: string;
};

export default function PassageVocabularyCapture({
  studentId,
  lessonId,
  passageId,
  passageText,
}: {
  studentId: string;
  lessonId: string;
  passageId: string;
  passageText: string;
}) {
  const [rawInput, setRawInput] = useState('');
  const [itemType, setItemType] = useState<'word' | 'phrase'>('word');
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function parseItems(input: string): CaptureItem[] {
    return input
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((itemText) => ({
        itemText,
        itemType,
        contextText: passageText.slice(0, 300),
      }));
  }

  function onSave() {
    setMessage(null);

    startTransition(async () => {
      const items = parseItems(rawInput);

      if (items.length === 0) {
        setMessage('Nothing to save');
        return;
      }

      const response = await fetch('/api/vocabulary/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          lessonId,
          passageId,
          items,
        }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage(json?.error ?? 'Save failed');
        return;
      }

      setRawInput('');
      setMessage('Saved to vocabulary');
    });
  }

  return (
    <div className="mt-4 rounded-xl border bg-white p-4">
      <div className="mb-2 font-medium text-slate-900">
        Unknown words / phrases
      </div>

      <select
        value={itemType}
        onChange={(e) => setItemType(e.target.value as 'word' | 'phrase')}
        className="mb-3 rounded-xl border px-3 py-2 text-slate-900"
      >
        <option value="word">word</option>
        <option value="phrase">phrase</option>
      </select>

      <textarea
        value={rawInput}
        onChange={(e) => setRawInput(e.target.value)}
        placeholder="One item per line"
        rows={4}
        className="w-full rounded-xl border px-3 py-2 text-slate-900"
      />

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={isPending}
          className="rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {isPending ? 'Saving...' : 'Save vocabulary'}
        </button>

        {message ? <span className="text-sm text-slate-600">{message}</span> : null}
      </div>
    </div>
  );
}