'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Question = {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: 'A' | 'B' | 'C' | 'D';
  question_type: string;
};

export default function LessonPlayer({
  lessonId,
  studentId,
  questions,
  onProgressChange,
  initialAnswers,
  initialQuestionIndex,
}: {
  lessonId: string;
  studentId: string;
  questions: Question[];
  onProgressChange?: (data: {
    totalQuestions: number;
    answeredQuestions: number;
  }) => void;
  initialAnswers?: Record<string, 'A' | 'B' | 'C' | 'D'>;
  initialQuestionIndex?: number;
}) {
  const [answers, setAnswers] = useState<Record<string, 'A' | 'B' | 'C' | 'D'>>(
    initialAnswers ?? {},
  );
  const [currentIndex, setCurrentIndex] = useState(
    Math.max(0, Math.min(initialQuestionIndex ?? 0, Math.max(questions.length - 1, 0))),
  );
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<null | {
    score: number;
    total: number;
    accuracy: number;
    weakSkills: string[];
    weakWords: string[];
  }>(null);
  const [loading, setLoading] = useState(false);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentQuestion = questions[currentIndex] ?? null;
  const totalQuestions = questions.length;

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);

  useEffect(() => {
    onProgressChange?.({
      totalQuestions,
      answeredQuestions: answeredCount,
    });
  }, [totalQuestions, answeredCount, onProgressChange]);

  useEffect(() => {
    if (submitted) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      fetch('/api/lesson/save-question-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          lessonId,
          answers,
          currentQuestionIndex: currentIndex,
        }),
      }).catch(() => {});
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [answers, currentIndex, studentId, lessonId, submitted]);

  function selectAnswer(questionId: string, option: 'A' | 'B' | 'C' | 'D') {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: option,
    }));
  }

  function goPrevious() {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }

  function goNext() {
    setCurrentIndex((prev) => Math.min(prev + 1, totalQuestions - 1));
  }

  async function submitLesson() {
    setLoading(true);

    const answersJson = questions.map((question) => {
      const selected = answers[question.id] ?? null;
      const isCorrect = selected === question.correct_option;

      return {
        questionId: question.id,
        questionType: question.question_type,
        selected,
        correctOption: question.correct_option,
        isCorrect,
      };
    });

    const score = answersJson.filter((item) => item.isCorrect).length;
    const total = questions.length;
    const accuracy = total > 0 ? score / total : 0;

    const weakSkills = Array.from(
      new Set(
        answersJson.filter((item) => !item.isCorrect).map((item) => item.questionType),
      ),
    );

    const response = await fetch('/api/lesson/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId,
        lessonId,
        score,
        totalQuestions: total,
        accuracy,
        weakSkills,
        weakWords: [],
        answersJson,
      }),
    });

    if (!response.ok) {
      alert('Submit failed');
      setLoading(false);
      return;
    }

    await fetch('/api/lesson/advance-stage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId,
        lessonId,
        action: 'mark_completed',
      }),
    });

    await fetch('/api/lesson/save-question-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId,
        lessonId,
        answers: {},
        currentQuestionIndex: 0,
      }),
    }).catch(() => {});

    setResult({
      score,
      total,
      accuracy,
      weakSkills,
      weakWords: [],
    });
    setSubmitted(true);
    setLoading(false);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!currentQuestion || submitted || loading) return;

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();

      if (
        tagName === 'input' ||
        tagName === 'textarea' ||
        target?.isContentEditable
      ) {
        return;
      }

      if (event.key === '1') {
        event.preventDefault();
        selectAnswer(currentQuestion.id, 'A');
        return;
      }

      if (event.key === '2') {
        event.preventDefault();
        selectAnswer(currentQuestion.id, 'B');
        return;
      }

      if (event.key === '3') {
        event.preventDefault();
        selectAnswer(currentQuestion.id, 'C');
        return;
      }

      if (event.key === '4') {
        event.preventDefault();
        selectAnswer(currentQuestion.id, 'D');
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrevious();
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (currentIndex < totalQuestions - 1) {
          goNext();
        }
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        if (currentIndex < totalQuestions - 1) {
          goNext();
        } else {
          void submitLesson();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentQuestion, currentIndex, totalQuestions, submitted, loading]);

  if (!currentQuestion) {
    return <p className="text-slate-600">No questions available.</p>;
  }

  if (submitted && result) {
    return (
      <div className="space-y-4 rounded-2xl border bg-white p-6">
        <h3 className="text-2xl font-semibold text-slate-900">Lesson submitted</h3>
        <p className="text-slate-700">
          Score: {result.score} / {result.total}
        </p>
        <p className="text-slate-700">
          Accuracy: {Math.round(result.accuracy * 100)}%
        </p>
        <p className="text-slate-700">
          Weak skills: {result.weakSkills.length > 0 ? result.weakSkills.join(', ') : 'None'}
        </p>
      </div>
    );
  }

  const options = [
    { key: 'A' as const, text: currentQuestion.option_a, shortcut: '1' },
    { key: 'B' as const, text: currentQuestion.option_b, shortcut: '2' },
    { key: 'C' as const, text: currentQuestion.option_c, shortcut: '3' },
    { key: 'D' as const, text: currentQuestion.option_d, shortcut: '4' },
  ];

  const isLastQuestion = currentIndex === totalQuestions - 1;
  const progressPercent =
    totalQuestions > 0 ? Math.round(((currentIndex + 1) / totalQuestions) * 100) : 0;

  return (
    <div className="relative space-y-6 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-500">
          Question {currentIndex + 1} of {totalQuestions}
        </div>
        <div className="text-sm text-slate-500">
          Answered: {answeredCount} / {totalQuestions}
        </div>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-slate-900 transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="text-sm text-slate-500">{currentQuestion.question_type}</div>

        <div className="mt-3 font-medium text-slate-900">
          {currentQuestion.question_text}
        </div>

        <div className="mt-4 space-y-2">
          {options.map((option) => {
            const isSelected = answers[currentQuestion.id] === option.key;

            return (
              <button
                key={option.key}
                type="button"
                onClick={() => selectAnswer(currentQuestion.id, option.key)}
                className={`block w-full rounded-xl border px-4 py-3 text-left ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50 text-slate-900'
                    : 'border-slate-200 bg-white text-slate-800'
                }`}
              >
                <span className="mr-2 inline-flex min-w-6 items-center justify-center rounded border border-slate-300 px-1 text-xs text-slate-600">
                  {option.shortcut}
                </span>
                <span className="font-semibold">{option.key}.</span> {option.text}
              </button>
            );
          })}
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-2 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="rounded-full border border-slate-300 px-3 py-1">1–4 choose</span>
            <span className="rounded-full border border-slate-300 px-3 py-1">← → navigate</span>
            <span className="rounded-full border border-slate-300 px-3 py-1">Enter continue</span>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={goPrevious}
              disabled={currentIndex === 0 || loading}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-slate-900 disabled:opacity-50"
            >
              Previous
            </button>

            {!isLastQuestion ? (
              <button
                type="button"
                onClick={goNext}
                disabled={loading}
                className="rounded-xl bg-slate-900 px-5 py-3 text-white disabled:opacity-50"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={submitLesson}
                disabled={loading}
                className="rounded-xl bg-slate-900 px-5 py-3 text-white disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit Lesson'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}