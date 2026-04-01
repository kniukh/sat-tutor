'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';

type ReviewQuestion = {
  id: string;
  question_type: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: 'A' | 'B' | 'C' | 'D';
  review_status?: 'draft' | 'approved' | 'rejected' | null;
  display_order: number;
};

type ReviewChunk = {
  id: string;
  title: string | null;
  chunkIndex: number;
  wordCount: number | null;
  status: string | null;
  chapterTitle: string | null;
  passageText: string;
  lessonId: string | null;
  lessonStatus: string | null;
  questions: ReviewQuestion[];
};

function formatLabel(value: string | null | undefined) {
  return (value ?? 'unknown').replace(/_/g, ' ');
}

function isVocabularyQuestion(questionType: string) {
  return questionType.toLowerCase().includes('vocab');
}

function QuestionPreview({ question }: { question: ReviewQuestion }) {
  const options = [
    { key: 'A', text: question.option_a },
    { key: 'B', text: question.option_b },
    { key: 'C', text: question.option_c },
    { key: 'D', text: question.option_d },
  ] as const;

  return (
    <div className="space-y-3">
      <div className="text-base font-semibold leading-7 text-slate-950">{question.question_text}</div>
      <div className="space-y-2">
        {options.map((option) => (
          <div
            key={option.key}
            className={`rounded-[1rem] border px-3 py-3 text-sm leading-6 ${
              question.correct_option === option.key
                ? 'border-emerald-200 bg-emerald-50 text-slate-950'
                : 'border-[var(--color-border)] bg-white text-slate-700'
            }`}
          >
            <span className="font-semibold">{option.key}.</span> {option.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestionReviewCard({ question }: { question: ReviewQuestion }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

  function approve() {
    runAction(async () => {
      const response = await fetch('/api/admin/questions/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.id,
          reviewStatus: 'approved',
        }),
      });

      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(json?.error ?? 'Failed to approve question');
      }
    });
  }

  function regenerate() {
    runAction(async () => {
      const response = await fetch('/api/admin/questions/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: question.id }),
      });

      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(json?.error ?? 'Failed to regenerate question');
      }
    });
  }

  function regenerateDistractors() {
    runAction(async () => {
      const response = await fetch('/api/admin/questions/regenerate-with-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.id,
          feedback:
            'Keep the stem and the correct answer, but replace the wrong choices with stronger SAT-style distractors of similar length, tone, and difficulty.',
        }),
      });

      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(json?.error ?? 'Failed to regenerate distractors');
      }
    });
  }

  return (
    <div className="rounded-[1.35rem] border border-[var(--color-border)] bg-white p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <span className="app-chip">{formatLabel(question.question_type)}</span>
          <span className={`app-chip ${question.review_status === 'approved' ? 'app-chip-success' : ''}`}>
            {question.review_status ?? 'draft'}
          </span>
        </div>
      </div>

      <QuestionPreview question={question} />

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={approve} disabled={isPending} className="primary-button">
          {isPending ? 'Updating...' : 'Approve'}
        </button>
        <button type="button" onClick={regenerate} disabled={isPending} className="secondary-button">
          Regenerate
        </button>
        <button type="button" onClick={regenerateDistractors} disabled={isPending} className="secondary-button">
          Regenerate Distractors
        </button>
      </div>

      {error ? <div className="mt-3 text-sm text-rose-600">{error}</div> : null}
    </div>
  );
}

export default function SourceChunkReview({
  chunks,
}: {
  chunks: ReviewChunk[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function approveAll(questionIds: string[]) {
    if (questionIds.length === 0) {
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        await Promise.all(
          questionIds.map(async (questionId) => {
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
          })
        );

        router.refresh();
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Action failed');
      }
    });
  }

  return (
    <div className="space-y-4">
      {chunks.map((chunk) => {
        const satQuestions = chunk.questions.filter((question) => !isVocabularyQuestion(question.question_type));
        const vocabQuestions = chunk.questions.filter((question) => isVocabularyQuestion(question.question_type));
        const allQuestionIds = chunk.questions.map((question) => question.id);
        const chunkApproved =
          chunk.questions.length > 0 && chunk.questions.every((question) => question.review_status === 'approved');

        return (
          <section key={chunk.id} className="card-surface p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <span className="app-chip">Chunk {chunk.chunkIndex + 1}</span>
                  <span className={`app-chip ${chunkApproved ? 'app-chip-success' : ''}`}>
                    {chunkApproved ? 'approved' : 'pending'}
                  </span>
                  {chunk.lessonStatus ? (
                    <span className="app-chip">{formatLabel(chunk.lessonStatus)}</span>
                  ) : null}
                </div>
                <div>
                  <div className="text-lg font-semibold text-slate-950">
                    {chunk.title || chunk.chapterTitle || `Chunk ${chunk.chunkIndex + 1}`}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {chunk.wordCount ?? 0} words
                    {chunk.chapterTitle ? ` · ${chunk.chapterTitle}` : ''}
                    {chunk.status ? ` · ${formatLabel(chunk.status)}` : ''}
                  </div>
                </div>
              </div>

              {chunk.questions.length > 0 ? (
                <button
                  type="button"
                  onClick={() => approveAll(allQuestionIds)}
                  disabled={isPending}
                  className="secondary-button"
                >
                  {isPending ? 'Updating...' : 'Approve All'}
                </button>
              ) : null}
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <div className="rounded-[1.35rem] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
                <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{chunk.passageText}</div>
              </div>

              <div className="space-y-4">
                {!chunk.lessonId ? (
                  <div className="rounded-[1.35rem] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-sm leading-6 text-slate-600">
                    This chunk is ready. Use <span className="font-semibold text-slate-950">Generate AI Lessons</span> above to create reviewable questions inline.
                  </div>
                ) : (
                  <>
                    <div className="space-y-3 rounded-[1.35rem] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="app-kicker text-slate-500">SAT Questions</div>
                        <div className="text-sm font-semibold text-slate-500">{satQuestions.length}</div>
                      </div>
                      {satQuestions.length === 0 ? (
                        <div className="text-sm text-slate-500">No SAT questions in this chunk yet.</div>
                      ) : (
                        <div className="space-y-3">
                          {satQuestions.map((question) => (
                            <QuestionReviewCard key={question.id} question={question} />
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 rounded-[1.35rem] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="app-kicker text-slate-500">Vocab Questions</div>
                        <div className="text-sm font-semibold text-slate-500">{vocabQuestions.length}</div>
                      </div>
                      {vocabQuestions.length === 0 ? (
                        <div className="text-sm text-slate-500">No vocabulary questions in this chunk yet.</div>
                      ) : (
                        <div className="space-y-3">
                          {vocabQuestions.map((question) => (
                            <QuestionReviewCard key={question.id} question={question} />
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        );
      })}

      {error ? <div className="text-sm text-rose-600">{error}</div> : null}
    </div>
  );
}
