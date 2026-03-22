'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import VocabularyReviewCards from '@/components/student/VocabularyReviewCards';

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

export default function LessonStagePanel({
  studentId,
  lessonId,
  passageId,
  stage,
  vocabItems,
}: {
  studentId: string;
  lessonId: string;
  passageId: string;
  stage: 'first_read' | 'vocab_review' | 'second_read' | 'questions' | 'completed';
  vocabItems: VocabItem[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitVocabulary() {
    setMessage(null);

    startTransition(async () => {
      const response = await fetch('/api/lesson/submit-vocabulary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, lessonId, passageId }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage(json?.error ?? 'Submit vocabulary failed');
        return;
      }

      router.refresh();
    });
  }

  function advance(action: 'start_second_read' | 'done_second_read' | 'mark_completed') {
    setMessage(null);

    startTransition(async () => {
      const response = await fetch('/api/lesson/advance-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, lessonId, action }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage(json?.error ?? 'Stage advance failed');
        return;
      }

      router.refresh();
    });
  }

  if (stage === 'first_read') {
    return (
      <div className="space-y-3">
        <p className="text-slate-600">
          First read: collect unknown words and phrases, then submit vocabulary.
        </p>
        <button
          type="button"
          onClick={submitVocabulary}
          disabled={isPending}
          className="rounded-xl bg-slate-900 px-5 py-3 text-white disabled:opacity-50"
        >
          {isPending ? 'Submitting...' : 'Submit Vocabulary'}
        </button>
        {message ? <p className="text-sm text-red-600">{message}</p> : null}
      </div>
    );
  }

  if (stage === 'vocab_review') {
    return (
      <div className="space-y-4">
        <div className="font-medium text-slate-900">Vocabulary support</div>

        <VocabularyReviewCards items={vocabItems} />

        <button
          type="button"
          onClick={() => advance('start_second_read')}
          disabled={isPending}
          className="rounded-xl bg-slate-900 px-5 py-3 text-white disabled:opacity-50"
        >
          {isPending ? 'Starting...' : 'Start Second Read'}
        </button>

        {message ? <p className="text-sm text-red-600">{message}</p> : null}
      </div>
    );
  }

  if (stage === 'second_read') {
    return (
      <div className="space-y-3">
        <p className="text-slate-600">
          Read the passage again with the vocabulary support in mind.
        </p>
        <button
          type="button"
          onClick={() => advance('done_second_read')}
          disabled={isPending}
          className="rounded-xl bg-slate-900 px-5 py-3 text-white disabled:opacity-50"
        >
          {isPending ? 'Saving...' : 'Done Second Read'}
        </button>
        {message ? <p className="text-sm text-red-600">{message}</p> : null}
      </div>
    );
  }

  if (stage === 'completed') {
    return <p className="text-slate-600">Lesson completed.</p>;
  }

  return null;
}