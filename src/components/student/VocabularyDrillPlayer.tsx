'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type DrillItem = {
  wordProgressId: string;
  vocabularyItemId: string;
  itemText: string;
  itemType: 'word' | 'phrase';
  correctAnswer: string;
  distractors: string[];
};

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function VocabularyDrillPlayer({
  items,
}: {
  items: DrillItem[];
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  const current = items[index] ?? null;

  const options = useMemo(() => {
    if (!current) return [];
    return shuffle([current.correctAnswer, ...(current.distractors ?? []).slice(0, 3)]);
  }, [current]);

  if (!current) {
    return <p className="text-slate-600">No drill items available.</p>;
  }

  async function submitReview(result: 'correct' | 'wrong') {
    await fetch('/api/vocabulary/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wordProgressId: current.wordProgressId, result }),
    });
  }

  function checkAnswer() {
    if (!selected) return;
    setChecked(true);

    startTransition(async () => {
      const result = selected === current.correctAnswer ? 'correct' : 'wrong';
      await submitReview(result);
    });
  }

  function nextItem() {
    setSelected(null);
    setChecked(false);

    if (index >= items.length - 1) {
      setDone(true);
      router.refresh();
      return;
    }

    setIndex((prev) => prev + 1);
  }

  if (done) {
    return (
      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">Drill complete</h2>
        <p className="text-slate-600">Your vocabulary review has been updated.</p>
      </div>
    );
  }

  const promptLabel =
    current.itemType === 'phrase'
      ? 'Choose the best paraphrase'
      : 'Choose the best meaning';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-500">
          Item {index + 1} of {items.length}
        </div>
        <div className="rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-700">
          {current.itemType}
        </div>
      </div>

      <div className="rounded-xl border p-4">
        <div className="text-sm text-slate-500">{promptLabel}</div>
        <div className="mt-2 text-2xl font-semibold text-slate-900">
          {current.itemText}
        </div>
      </div>

      <div className="space-y-2">
        {options.map((option) => {
          const isSelected = selected === option;
          const isCorrect = checked && option === current.correctAnswer;
          const isWrongSelected = checked && isSelected && option !== current.correctAnswer;

          return (
            <button
              key={option}
              type="button"
              disabled={checked}
              onClick={() => setSelected(option)}
              className={`block w-full rounded-xl border px-4 py-3 text-left ${
                isCorrect
                  ? 'border-green-600 bg-green-50 text-slate-900'
                  : isWrongSelected
                    ? 'border-red-600 bg-red-50 text-slate-900'
                    : isSelected
                      ? 'border-blue-600 bg-blue-50 text-slate-900'
                      : 'border-slate-200 bg-white text-slate-800'
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>

      {!checked ? (
        <button
          type="button"
          disabled={!selected || isPending}
          onClick={checkAnswer}
          className="rounded-xl bg-slate-900 px-5 py-3 text-white disabled:opacity-50"
        >
          Check
        </button>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border bg-white p-4 text-slate-700">
            Correct answer: <span className="font-semibold">{current.correctAnswer}</span>
          </div>
          <button
            type="button"
            onClick={nextItem}
            className="rounded-xl bg-slate-900 px-5 py-3 text-white"
          >
            {index >= items.length - 1 ? 'Finish' : 'Next'}
          </button>
        </div>
      )}
    </div>
  );
}