'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type ReviewQuestion = {
  id: string;
  review_status?: 'draft' | 'approved' | 'rejected' | null;
};

type ReviewChunk = {
  lessonId: string | null;
  questions: ReviewQuestion[];
};

type Props = {
  chunks: ReviewChunk[];
};

export default function ContentPipelineBatchActions({ chunks }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { allQuestionIds, publishableLessonIds } = useMemo(() => {
    const questionIds: string[] = [];
    const lessonIds: string[] = [];

    for (const chunk of chunks) {
      for (const question of chunk.questions) {
        questionIds.push(question.id);
      }

      if (
        chunk.lessonId &&
        chunk.questions.length > 0 &&
        chunk.questions.every((question) => question.review_status === 'approved')
      ) {
        lessonIds.push(chunk.lessonId);
      }
    }

    return {
      allQuestionIds: questionIds,
      publishableLessonIds: Array.from(new Set(lessonIds)),
    };
  }, [chunks]);

  function runAction(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Action failed');
      }
    });
  }

  function approveAll() {
    if (allQuestionIds.length === 0) {
      return;
    }

    runAction(async () => {
      await Promise.all(
        allQuestionIds.map(async (questionId) => {
          const response = await fetch('/api/admin/questions/review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              questionId,
              reviewStatus: 'approved',
            }),
          });

          const json = await response.json().catch(() => null);
          if (!response.ok) {
            throw new Error(json?.error ?? 'Failed to approve all questions');
          }
        }),
      );
    });
  }

  function publishApproved() {
    if (publishableLessonIds.length === 0) {
      return;
    }

    runAction(async () => {
      await Promise.all(
        publishableLessonIds.map(async (lessonId) => {
          const response = await fetch('/api/admin/lesson-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lessonId, status: 'published' }),
          });

          const json = await response.json().catch(() => null);
          if (!response.ok) {
            throw new Error(json?.error ?? 'Failed to publish approved lessons');
          }
        }),
      );
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={approveAll}
          disabled={isPending || allQuestionIds.length === 0}
          className="secondary-button"
        >
          {isPending ? 'Updating...' : 'Approve All'}
        </button>

        <button
          type="button"
          onClick={publishApproved}
          disabled={isPending || publishableLessonIds.length === 0}
          className="primary-button disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? 'Publishing...' : 'Publish Approved'}
        </button>
      </div>

      {error ? <div className="text-sm text-rose-600">{error}</div> : null}
    </div>
  );
}
