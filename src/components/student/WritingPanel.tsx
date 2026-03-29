'use client';

import { useState, useTransition } from 'react';

type WritingPrompt = {
  id: string;
  prompt_text: string;
};

export default function WritingPanel({
  studentId,
  lessonId,
  prompt,
}: {
  studentId: string;
  lessonId: string;
  prompt: WritingPrompt;
}) {
  const [responseText, setResponseText] = useState('');
  const [feedback, setFeedback] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit() {
    setError(null);

    startTransition(async () => {
      const response = await fetch('/api/writing/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          lessonId,
          writingPromptId: prompt.id,
          responseText,
        }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        setError(json?.error ?? 'Submit failed');
        return;
      }

      setFeedback(json?.data?.ai_feedback ?? null);
    });
  }

  return (
    <div className="space-y-4 rounded-2xl border bg-white p-6">
      <h2 className="text-xl font-semibold text-slate-900">Writing Practice</h2>

      <div className="font-medium text-slate-900">{prompt.prompt_text}</div>

      <textarea
        value={responseText}
        onChange={(e) => setResponseText(e.target.value)}
        rows={6}
        placeholder="Write your short answer here..."
        className="w-full rounded-xl border px-3 py-2 text-slate-900"
      />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="button"
        onClick={onSubmit}
        disabled={isPending || !responseText.trim()}
        className="rounded-xl bg-slate-900 px-5 py-3 text-white disabled:opacity-50"
      >
        {isPending ? 'Evaluating...' : 'Submit Writing'}
      </button>

      {feedback ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm text-slate-500">
            Score: <span className="font-semibold text-slate-900">{feedback.overall_score}/5</span>
          </div>
          <div className="text-sm text-slate-700">
            <span className="font-medium">Clarity:</span> {feedback.clarity}
          </div>
          <div className="text-sm text-slate-700">
            <span className="font-medium">Logic:</span> {feedback.logic}
          </div>
          <div className="text-sm text-slate-700">
            <span className="font-medium">Completeness:</span> {feedback.completeness}
          </div>
          <div className="text-sm text-slate-700">
            <span className="font-medium">Feedback:</span> {feedback.concise_feedback}
          </div>
        </div>
      ) : null}
    </div>
  );
}
