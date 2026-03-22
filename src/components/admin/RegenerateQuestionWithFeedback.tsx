'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function RegenerateQuestionWithFeedback({
  questionId,
}: {
  questionId: string;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState('');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const response = await fetch('/api/admin/questions/regenerate-with-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, feedback }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        setError(json?.error ?? 'Failed to regenerate question');
        return;
      }

      setFeedback('');
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900"
      >
        {open ? 'Close Feedback' : 'Regenerate with Feedback'}
      </button>

      {open ? (
        <form onSubmit={onSubmit} className="space-y-3 rounded-xl border p-3">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Example: too easy, wrong answers are weak, make vocabulary question more passage-grounded"
            rows={4}
            className="w-full rounded-xl border px-3 py-2 text-slate-900"
          />

          <button
            type="submit"
            disabled={isPending || !feedback.trim()}
            className="rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
          >
            {isPending ? 'Regenerating...' : 'Submit Feedback'}
          </button>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </form>
      ) : null}
    </div>
  );
}