'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import GenerateQuestionsButton from '@/components/admin/GenerateQuestionsButton';

type PassageItem = {
  id: string;
  title: string | null;
  passage_text: string;
  display_order: number;
};

type QuestionItem = {
  id: string;
  question_type: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: 'A' | 'B' | 'C' | 'D';
  explanation?: string | null;
  display_order: number;
  review_status?: 'draft' | 'approved' | 'rejected' | null;
  generation_source?: string | null;
  generation_version?: number | null;
};

type Props = {
  lessonId: string;
  lessonStatus: string;
  lessonType: string;
  passages: PassageItem[];
  questions: QuestionItem[];
};

function formatLabel(value: string) {
  return value.replace(/_/g, ' ');
}

function isVocabularyQuestion(questionType: string) {
  return questionType.toLowerCase().includes('vocab');
}

function groupQuestionsByPassage(passages: PassageItem[], questions: QuestionItem[]) {
  if (passages.length <= 1) {
    return passages.map((passage, index) => ({
      passage,
      questions: index === 0 ? questions : [],
    }));
  }

  const size = Math.ceil(questions.length / passages.length);
  return passages.map((passage, index) => ({
    passage,
    questions: questions.slice(index * size, index * size + size),
  }));
}

function QuestionPreview({ question }: { question: QuestionItem }) {
  const options = [
    { key: 'A', text: question.option_a },
    { key: 'B', text: question.option_b },
    { key: 'C', text: question.option_c },
    { key: 'D', text: question.option_d },
  ] as const;

  return (
    <div className="space-y-3">
      <div className="token-text-primary text-base font-semibold leading-7">
        {question.question_text}
      </div>
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
      {question.explanation ? (
        <div className="token-text-secondary text-sm leading-6">{question.explanation}</div>
      ) : null}
    </div>
  );
}

function InlineQuestionCard({ question }: { question: QuestionItem }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [form, setForm] = useState({
    questionType: question.question_type,
    questionText: question.question_text,
    optionA: question.option_a,
    optionB: question.option_b,
    optionC: question.option_c,
    optionD: question.option_d,
    correctOption: question.correct_option,
    explanation: question.explanation ?? '',
    displayOrder: question.display_order,
  });

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

  function updateReviewStatus(nextStatus: 'approved' | 'draft' | 'rejected') {
    runAction(async () => {
      const response = await fetch('/api/admin/questions/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.id,
          reviewStatus: nextStatus,
        }),
      });

      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(json?.error ?? 'Failed to update question');
      }
    });
  }

  function saveInlineEdit() {
    runAction(async () => {
      const response = await fetch('/api/admin/questions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.id,
          ...form,
        }),
      });

      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(json?.error ?? 'Failed to save question');
      }

      setEditOpen(false);
    });
  }

  function regenerateQuestion() {
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
            'Keep the question stem and the correct answer, but replace the wrong answer choices with stronger SAT-style distractors of similar length and difficulty.',
        }),
      });

      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(json?.error ?? 'Failed to regenerate distractors');
      }
    });
  }

  function submitFeedbackRegeneration() {
    if (!feedback.trim()) {
      setError('Feedback is required.');
      return;
    }

    runAction(async () => {
      const response = await fetch('/api/admin/questions/regenerate-with-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.id,
          feedback,
        }),
      });

      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(json?.error ?? 'Failed to regenerate question');
      }

      setFeedback('');
      setFeedbackOpen(false);
    });
  }

  return (
    <div className="surface-panel rounded-[1.4rem] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <span className="app-chip">{formatLabel(question.question_type)}</span>
          <span
            className={`app-chip ${
              question.review_status === 'approved'
                ? 'app-chip-success'
                : question.review_status === 'rejected'
                  ? 'app-chip-error'
                  : ''
            }`}
          >
            {question.review_status ?? 'draft'}
          </span>
        </div>

        <div className="token-text-muted text-xs font-semibold uppercase tracking-[0.16em]">
          {question.generation_source ?? 'manual'} · v{question.generation_version ?? 1}
        </div>
      </div>

      <div className="mt-4">
        {editOpen ? (
          <div className="space-y-3">
            <select
              value={form.questionType}
              onChange={(event) =>
                setForm((current) => ({ ...current, questionType: event.target.value }))
              }
              className="surface-panel token-text-primary w-full rounded-[1rem] border border-[var(--color-border)] px-3 py-2 text-sm"
            >
              <option value="main_idea">main_idea</option>
              <option value="detail">detail</option>
              <option value="inference">inference</option>
              <option value="vocabulary">vocabulary</option>
              <option value="tone">tone</option>
            </select>

            <textarea
              value={form.questionText}
              onChange={(event) =>
                setForm((current) => ({ ...current, questionText: event.target.value }))
              }
              rows={3}
              className="surface-panel token-text-primary w-full rounded-[1rem] border border-[var(--color-border)] px-3 py-2 text-sm"
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <input value={form.optionA} onChange={(event) => setForm((current) => ({ ...current, optionA: event.target.value }))} className="surface-panel token-text-primary w-full rounded-[1rem] border border-[var(--color-border)] px-3 py-2 text-sm" placeholder="Option A" />
              <input value={form.optionB} onChange={(event) => setForm((current) => ({ ...current, optionB: event.target.value }))} className="surface-panel token-text-primary w-full rounded-[1rem] border border-[var(--color-border)] px-3 py-2 text-sm" placeholder="Option B" />
              <input value={form.optionC} onChange={(event) => setForm((current) => ({ ...current, optionC: event.target.value }))} className="surface-panel token-text-primary w-full rounded-[1rem] border border-[var(--color-border)] px-3 py-2 text-sm" placeholder="Option C" />
              <input value={form.optionD} onChange={(event) => setForm((current) => ({ ...current, optionD: event.target.value }))} className="surface-panel token-text-primary w-full rounded-[1rem] border border-[var(--color-border)] px-3 py-2 text-sm" placeholder="Option D" />
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
              <select
                value={form.correctOption}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    correctOption: event.target.value as 'A' | 'B' | 'C' | 'D',
                  }))
                }
                className="surface-panel token-text-primary w-full rounded-[1rem] border border-[var(--color-border)] px-3 py-2 text-sm"
              >
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
              <input
                type="number"
                value={form.displayOrder}
                onChange={(event) =>
                  setForm((current) => ({ ...current, displayOrder: Number(event.target.value) }))
                }
                className="surface-panel token-text-primary w-full rounded-[1rem] border border-[var(--color-border)] px-3 py-2 text-sm"
              />
            </div>

            <textarea
              value={form.explanation}
              onChange={(event) =>
                setForm((current) => ({ ...current, explanation: event.target.value }))
              }
              rows={3}
              className="surface-panel token-text-primary w-full rounded-[1rem] border border-[var(--color-border)] px-3 py-2 text-sm"
              placeholder="Explanation"
            />
          </div>
        ) : (
          <QuestionPreview question={question} />
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {editOpen ? (
          <>
            <button type="button" onClick={saveInlineEdit} disabled={isPending} className="primary-button">
              {isPending ? 'Saving...' : 'Save'}
            </button>
            <button type="button" onClick={() => setEditOpen(false)} className="secondary-button">
              Cancel
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setEditOpen(true)} className="secondary-button">
              Edit Inline
            </button>
            <button type="button" onClick={() => updateReviewStatus('approved')} disabled={isPending} className="primary-button">
              Approve
            </button>
            <button type="button" onClick={regenerateQuestion} disabled={isPending} className="secondary-button">
              Regenerate
            </button>
            <button type="button" onClick={regenerateDistractors} disabled={isPending} className="secondary-button">
              Regenerate Distractors
            </button>
            <button type="button" onClick={() => setFeedbackOpen((current) => !current)} className="secondary-button">
              {feedbackOpen ? 'Close Feedback' : 'Regenerate with Feedback'}
            </button>
          </>
        )}
      </div>

      {feedbackOpen ? (
        <div className="surface-soft-panel mt-4 space-y-3 rounded-[1rem] p-3">
          <textarea
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            rows={4}
            placeholder="Explain what should change."
            className="surface-panel token-text-primary w-full rounded-[1rem] border border-[var(--color-border)] px-3 py-2 text-sm"
          />
          <button type="button" onClick={submitFeedbackRegeneration} disabled={isPending || !feedback.trim()} className="primary-button">
            {isPending ? 'Regenerating...' : 'Submit Feedback'}
          </button>
        </div>
      ) : null}

      {error ? <div className="mt-3 text-sm text-rose-600">{error}</div> : null}
    </div>
  );
}

function InlinePassageCard({ passage }: { passage: PassageItem }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: passage.title ?? '',
    passageText: passage.passage_text,
    displayOrder: passage.display_order,
  });

  function savePassage() {
    setError(null);
    startTransition(async () => {
      const response = await fetch('/api/admin/passages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passageId: passage.id,
          title: form.title,
          passageText: form.passageText,
          displayOrder: form.displayOrder,
        }),
      });

      const json = await response.json().catch(() => null);
      if (!response.ok) {
        setError(json?.error ?? 'Failed to save chunk');
        return;
      }

      setEditOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="surface-panel space-y-4 rounded-[1.4rem] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="app-kicker token-text-muted">Chunk</div>
          <div className="token-text-primary mt-1 text-lg font-semibold">
            {passage.title || `Chunk ${passage.display_order}`}
          </div>
        </div>

        <button type="button" onClick={editOpen ? savePassage : () => setEditOpen(true)} disabled={isPending} className={editOpen ? 'primary-button' : 'secondary-button'}>
          {editOpen ? (isPending ? 'Saving...' : 'Save Chunk') : 'Edit Chunk'}
        </button>
      </div>

      {editOpen ? (
        <div className="space-y-3">
          <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="surface-panel token-text-primary w-full rounded-[1rem] border border-[var(--color-border)] px-3 py-2 text-sm" placeholder="Chunk title" />
          <textarea value={form.passageText} onChange={(event) => setForm((current) => ({ ...current, passageText: event.target.value }))} rows={18} className="surface-panel token-text-primary w-full rounded-[1rem] border border-[var(--color-border)] px-3 py-3 text-sm leading-7" />
        </div>
      ) : (
        <div className="token-text-secondary whitespace-pre-wrap text-sm leading-7">
          {passage.passage_text}
        </div>
      )}

      {editOpen ? (
        <button type="button" onClick={() => setEditOpen(false)} className="secondary-button">
          Cancel
        </button>
      ) : null}

      {error ? <div className="text-sm text-rose-600">{error}</div> : null}
    </div>
  );
}

export default function InlineLessonReview({
  lessonId,
  lessonStatus,
  lessonType,
  passages,
  questions,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const chunkGroups = useMemo(() => groupQuestionsByPassage(passages, questions), [passages, questions]);
  const approvedQuestionsCount = questions.filter((question) => question.review_status === 'approved').length;
  const allApproved = questions.length > 0 && approvedQuestionsCount === questions.length;
  const approvedChunks = chunkGroups.filter((group) => group.questions.length > 0 && group.questions.every((question) => question.review_status === 'approved')).length;

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

  function updateQuestionStatus(questionId: string, reviewStatus: 'approved' | 'draft' | 'rejected') {
    return fetch('/api/admin/questions/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, reviewStatus }),
    }).then(async (response) => {
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(json?.error ?? 'Failed to update question');
      }
    });
  }

  function approveChunk(questionIds: string[]) {
    if (questionIds.length === 0) return;
    runAction(async () => {
      await Promise.all(questionIds.map((questionId) => updateQuestionStatus(questionId, 'approved')));
    });
  }

  function approveAll() {
    if (questions.length === 0) return;
    runAction(async () => {
      await Promise.all(questions.map((question) => updateQuestionStatus(question.id, 'approved')));
    });
  }

  function publishApproved() {
    runAction(async () => {
      const response = await fetch('/api/admin/lesson-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, status: 'published' }),
      });

      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(json?.error ?? 'Failed to publish lesson');
      }
    });
  }

  return (
    <div className="space-y-5">
      <section className="card-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="app-kicker">Lesson Review</div>
            <h2 className="token-text-primary mt-1 text-2xl font-semibold tracking-[-0.02em]">
              Scan, fix, approve, publish
            </h2>
            <p className="token-text-secondary mt-2 max-w-3xl text-sm leading-6">
              Review each chunk inline, edit questions without leaving the page, and publish only when the lesson is ready.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="app-chip">{lessonType}</span>
            <span className={`app-chip ${lessonStatus === 'published' ? 'app-chip-success' : ''}`}>
              {lessonStatus}
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="app-card-soft p-4"><div className="app-kicker token-text-muted">Chunks</div><div className="token-text-primary mt-2 text-3xl font-semibold">{passages.length}</div></div>
          <div className="app-card-soft p-4"><div className="app-kicker token-text-muted">Questions</div><div className="token-text-primary mt-2 text-3xl font-semibold">{questions.length}</div></div>
          <div className="app-card-soft p-4"><div className="app-kicker token-text-muted">Approved</div><div className="token-text-primary mt-2 text-3xl font-semibold">{approvedQuestionsCount}</div></div>
          <div className="app-card-soft p-4"><div className="app-kicker token-text-muted">Approved Chunks</div><div className="token-text-primary mt-2 text-3xl font-semibold">{approvedChunks}</div></div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <GenerateQuestionsButton lessonId={lessonId} />
          <button type="button" onClick={approveAll} disabled={isPending || questions.length === 0} className="secondary-button">
            {isPending ? 'Updating...' : 'Approve All'}
          </button>
          <button type="button" onClick={publishApproved} disabled={isPending || !allApproved} className="primary-button disabled:cursor-not-allowed disabled:opacity-50">
            {isPending ? 'Publishing...' : 'Publish Approved'}
          </button>
          <Link href={`/s/demo123/lesson/${lessonId}`} target="_blank" rel="noreferrer" className="secondary-button">
            Preview Lesson
          </Link>
        </div>

        {error ? <div className="mt-3 text-sm text-rose-600">{error}</div> : null}
      </section>

      <section className="space-y-4">
        {chunkGroups.map((group, index) => {
          const satQuestions = group.questions.filter((question) => !isVocabularyQuestion(question.question_type));
          const vocabQuestions = group.questions.filter((question) => isVocabularyQuestion(question.question_type));
          const chunkApproved = group.questions.length > 0 && group.questions.every((question) => question.review_status === 'approved');

          return (
            <section key={group.passage.id} className="card-surface p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="app-chip">Chunk {index + 1}</span>
                  <span className={`app-chip ${chunkApproved ? 'app-chip-success' : ''}`}>
                    {chunkApproved ? 'approved' : 'pending'}
                  </span>
                </div>

                <button type="button" onClick={() => approveChunk(group.questions.map((question) => question.id))} disabled={isPending || group.questions.length === 0} className="secondary-button">
                  Approve Chunk
                </button>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                <InlinePassageCard passage={group.passage} />

                <div className="space-y-4">
                  <div className="surface-soft-panel space-y-3 rounded-[1.4rem] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="app-kicker token-text-muted">SAT Questions</div>
                      <div className="token-text-muted text-sm font-semibold">{satQuestions.length}</div>
                    </div>
                    {satQuestions.length === 0 ? (
                      <div className="token-text-muted text-sm">No SAT questions in this chunk yet.</div>
                    ) : (
                      <div className="space-y-3">
                        {satQuestions.map((question) => (
                          <InlineQuestionCard key={question.id} question={question} />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="surface-soft-panel space-y-3 rounded-[1.4rem] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="app-kicker token-text-muted">Vocab Questions</div>
                      <div className="token-text-muted text-sm font-semibold">{vocabQuestions.length}</div>
                    </div>
                    {vocabQuestions.length === 0 ? (
                      <div className="token-text-muted text-sm">No vocabulary questions in this chunk yet.</div>
                    ) : (
                      <div className="space-y-3">
                        {vocabQuestions.map((question) => (
                          <InlineQuestionCard key={question.id} question={question} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </section>
    </div>
  );
}
