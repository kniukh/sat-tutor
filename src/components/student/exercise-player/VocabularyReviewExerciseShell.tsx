'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { VocabExerciseSession } from '@/services/vocabulary/session-builder';
import ExercisePlayer from './ExercisePlayer';
import type { Exercise, ExerciseResult } from './types';

type ReviewableItem = {
  wordProgressId: string;
};

type Props<TItem extends ReviewableItem> = {
  items: TItem[];
  exercises: Exercise[];
  session?: VocabExerciseSession | null;
  title: string;
  emptyMessage: string;
  completeTitle: string;
  completeDescription: string;
};

export default function VocabularyReviewExerciseShell<TItem extends ReviewableItem>({
  items,
  exercises,
  session,
  title,
  emptyMessage,
  completeTitle,
  completeDescription,
}: Props<TItem>) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [, startTransition] = useTransition();

  const itemByExerciseId = useMemo(() => {
    const itemMap = new Map(items.map((item) => [item.wordProgressId, item]));

    return new Map(
      exercises.map((exercise) => [
        exercise.id,
        itemMap.get(exercise.reviewMeta?.sourceDrillId ?? ''),
      ])
    );
  }, [items, exercises]);

  if (!items.length) {
    return <p className="text-slate-600">{emptyMessage}</p>;
  }

  async function submitReview(wordProgressId: string, result: 'correct' | 'wrong') {
    await fetch('/api/vocabulary/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wordProgressId, result }),
    });
  }

  function handleExerciseComplete(result: ExerciseResult) {
    const sourceItem = itemByExerciseId.get(result.exercise_id);
    if (!sourceItem) return;

    startTransition(async () => {
      await submitReview(sourceItem.wordProgressId, result.is_correct ? 'correct' : 'wrong');
    });
  }

  function handleComplete() {
    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">{completeTitle}</h2>
        <p className="text-slate-600">{completeDescription}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {process.env.NODE_ENV !== 'production' && session ? (
        <details className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">
            Session Summary
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Session ID
              </div>
              <div className="mt-2 break-all text-sm text-slate-700">{session.session_id}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Actual Size
              </div>
              <div className="mt-2 text-lg font-semibold text-slate-950">
                {session.metadata.actual_size}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Counts By Type
              </div>
              <div className="mt-2 text-sm text-slate-700">
                {Object.entries(session.metadata.counts_by_type)
                  .map(([type, count]) => `${type}: ${count}`)
                  .join(' · ') || 'No counts'}
              </div>
            </div>
          </div>
        </details>
      ) : null}

      <ExercisePlayer
        exercises={exercises}
        title={title}
        onExerciseComplete={handleExerciseComplete}
        onComplete={handleComplete}
      />
    </div>
  );
}
