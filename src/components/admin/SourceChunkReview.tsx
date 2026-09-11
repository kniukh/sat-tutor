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
  contentMode?: 'sat' | 'det' | null;
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
      <div className="token-text-primary text-base font-semibold leading-7">{question.question_text}</div>
      <div className="space-y-2">
        {options.map((option) => (
          <div
            key={option.key}
            className={`rounded-[1rem] border px-3 py-3 text-sm leading-6 ${
              question.correct_option === option.key
                ? 'border-[var(--color-success)] bg-[var(--color-success-soft)] text-[var(--color-text-primary)]'
                : 'surface-panel token-text-secondary'
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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ questionText: question.question_text, optionA: question.option_a, optionB: question.option_b, optionC: question.option_c, optionD: question.option_d, correctOption: question.correct_option });

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

  function saveEdit() {
    runAction(async () => {
      const response = await fetch('/api/admin/questions/review', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId: question.id, ...draft }) });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.error ?? 'Failed to save question');
      setEditing(false);
    });
  }

  return (
    <div className="surface-panel rounded-[1.35rem] p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <span className="app-chip">{formatLabel(question.question_type)}</span>
          <span className={`app-chip ${question.review_status === 'approved' ? 'app-chip-success' : ''}`}>
            {question.review_status ?? 'draft'}
          </span>
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea value={draft.questionText} onChange={(event) => setDraft({ ...draft, questionText: event.target.value })} rows={3} className="w-full rounded-xl border border-line px-3 py-2 text-sm" />
          {(['A', 'B', 'C', 'D'] as const).map((key) => {
            const field = `option${key}` as 'optionA' | 'optionB' | 'optionC' | 'optionD';
            return <div key={key} className="flex items-center gap-2"><input type="radio" checked={draft.correctOption === key} onChange={() => setDraft({ ...draft, correctOption: key })} /><input value={draft[field]} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} className="w-full rounded-xl border border-line px-3 py-2 text-sm" /></div>;
          })}
        </div>
      ) : <QuestionPreview question={question} />}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={approve} disabled={isPending} className="primary-button">
          {isPending ? 'Updating...' : 'Approve'}
        </button>
        {editing ? <button type="button" onClick={saveEdit} disabled={isPending} className="primary-button">Save edit</button> : <button type="button" onClick={() => setEditing(true)} disabled={isPending} className="secondary-button">Edit</button>}
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

function ChunkTextEditor({ chunk }: { chunk: ReviewChunk }) {
  const router = useRouter();
  const [text, setText] = useState(chunk.passageText);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const sentenceWarning = text.trim() && !/[.!?][\"']?$/.test(text.trim())
    ? 'Chunk should end at a complete sentence.'
    : null;

  function save() {
    setError(null);
    startTransition(async () => {
      const response = await fetch('/api/admin/generated-passages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passageId: chunk.id, passageText: text }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        setError(json?.error ?? 'Failed to save chunk');
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={10}
        className="w-full rounded-[1rem] border border-[var(--color-border)] bg-white px-3 py-3 text-sm leading-7 text-slate-900"
        aria-label={`Edit ${chunk.title ?? `chunk ${chunk.chunkIndex + 1}`}`}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>{wordCount} words{sentenceWarning ? ` · ${sentenceWarning}` : ''}</span>
        <button type="button" onClick={save} disabled={isPending || wordCount < 20 || text.trim() === chunk.passageText.trim()} className="primary-button disabled:cursor-not-allowed disabled:opacity-50">
          {isPending ? 'Saving...' : 'Save chunk'}
        </button>
      </div>
      {error ? <div className="text-sm text-rose-600">{error}</div> : null}
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
                  <span className="app-chip">{(chunk.contentMode ?? 'sat').toUpperCase()}</span>
                  <span className={`app-chip ${chunkApproved ? 'app-chip-success' : ''}`}>
                    {chunkApproved ? 'approved' : 'pending'}
                  </span>
                  {chunk.lessonStatus ? (
                    <span className="app-chip">{formatLabel(chunk.lessonStatus)}</span>
                  ) : null}
                </div>
                <div>
                  <div className="token-text-primary text-lg font-semibold">
                    {chunk.title || chunk.chapterTitle || `Chunk ${chunk.chunkIndex + 1}`}
                  </div>
                  <div className="token-text-muted mt-1 text-sm">
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
              <div className="surface-soft-panel rounded-[1.35rem] p-4">
                <ChunkTextEditor chunk={chunk} />
              </div>

              <div className="space-y-4">
                {!chunk.lessonId ? (
                  <div className="surface-soft-panel token-text-secondary rounded-[1.35rem] p-4 text-sm leading-6">
                    This chunk is ready. Use <span className="token-text-primary font-semibold">Generate AI Lessons</span> above to create reviewable questions inline.
                  </div>
                ) : (
                  <>
                    <div className="surface-soft-panel space-y-3 rounded-[1.35rem] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="app-kicker token-text-muted">{chunk.contentMode === 'det' ? 'DET Questions' : 'SAT Questions'}</div>
                        <div className="token-text-muted text-sm font-semibold">{satQuestions.length}</div>
                      </div>
                      {satQuestions.length === 0 ? (
                        <div className="token-text-muted text-sm">No SAT questions in this chunk yet.</div>
                      ) : (
                        <div className="space-y-3">
                          {satQuestions.map((question) => (
                            <QuestionReviewCard key={question.id} question={question} />
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="surface-soft-panel space-y-3 rounded-[1.35rem] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="app-kicker token-text-muted">Vocab Questions</div>
                        <div className="token-text-muted text-sm font-semibold">{vocabQuestions.length}</div>
                      </div>
                      {vocabQuestions.length === 0 ? (
                        <div className="token-text-muted text-sm">No vocabulary questions in this chunk yet.</div>
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
