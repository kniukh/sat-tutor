'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function AddQuestionForm({ lessonId }: { lessonId: string }) {
  const router = useRouter();
  const [questionType, setQuestionType] = useState('main_idea');
  const [questionText, setQuestionText] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [optionD, setOptionD] = useState('');
  const [correctOption, setCorrectOption] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [displayOrder, setDisplayOrder] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const response = await fetch('/api/admin/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId,
          questionType,
          questionText,
          optionA,
          optionB,
          optionC,
          optionD,
          correctOption,
          displayOrder,
        }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        setError(json?.error ?? 'Failed to add question');
        return;
      }

      setQuestionText('');
      setOptionA('');
      setOptionB('');
      setOptionC('');
      setOptionD('');
      setCorrectOption('A');
      setDisplayOrder(1);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border bg-white p-6">
      <h2 className="text-xl font-semibold text-slate-900">Add Question</h2>

      <select
        value={questionType}
        onChange={(e) => setQuestionType(e.target.value)}
        className="w-full rounded-xl border px-3 py-2 text-slate-900"
      >
        <option value="main_idea">main_idea</option>
        <option value="detail">detail</option>
        <option value="inference">inference</option>
        <option value="vocabulary">vocabulary</option>
      </select>

      <textarea
        value={questionText}
        onChange={(e) => setQuestionText(e.target.value)}
        placeholder="Question text"
        rows={4}
        className="w-full rounded-xl border px-3 py-2 text-slate-900"
      />

      <input value={optionA} onChange={(e) => setOptionA(e.target.value)} placeholder="Option A" className="w-full rounded-xl border px-3 py-2 text-slate-900" />
      <input value={optionB} onChange={(e) => setOptionB(e.target.value)} placeholder="Option B" className="w-full rounded-xl border px-3 py-2 text-slate-900" />
      <input value={optionC} onChange={(e) => setOptionC(e.target.value)} placeholder="Option C" className="w-full rounded-xl border px-3 py-2 text-slate-900" />
      <input value={optionD} onChange={(e) => setOptionD(e.target.value)} placeholder="Option D" className="w-full rounded-xl border px-3 py-2 text-slate-900" />

      <select
        value={correctOption}
        onChange={(e) => setCorrectOption(e.target.value as 'A' | 'B' | 'C' | 'D')}
        className="w-full rounded-xl border px-3 py-2 text-slate-900"
      >
        <option value="A">A</option>
        <option value="B">B</option>
        <option value="C">C</option>
        <option value="D">D</option>
      </select>

      <input
        type="number"
        value={displayOrder}
        onChange={(e) => setDisplayOrder(Number(e.target.value))}
        className="w-full rounded-xl border px-3 py-2 text-slate-900"
      />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={
          isPending ||
          !questionText ||
          !optionA ||
          !optionB ||
          !optionC ||
          !optionD
        }
        className="rounded-xl bg-slate-900 px-5 py-3 text-white disabled:opacity-50"
      >
        {isPending ? 'Adding...' : 'Add Question'}
      </button>
    </form>
  );
}