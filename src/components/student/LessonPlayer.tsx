"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

type Question = {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option?: string;
  explanation?: string | null;
  question_type: string;
};

type Props = {
  studentId: string;
  lessonId: string;
  questions: Question[];
  onFinished?: () => void;
  onProgressChange?: Dispatch<
    SetStateAction<{
      totalQuestions: number;
      answeredQuestions: number;
    }>
  >;
  initialAnswers?: Record<string, "A" | "B" | "C" | "D">;
  initialQuestionIndex?: number;
};

export default function LessonPlayer({
  studentId,
  lessonId,
  questions,
  onFinished,
  onProgressChange,
  initialAnswers,
  initialQuestionIndex = 0,
}: Props) {
  const [index, setIndex] = useState(initialQuestionIndex);
  const [selected, setSelected] = useState<string | null>(
    questions[initialQuestionIndex]
      ? initialAnswers?.[questions[initialQuestionIndex].id] ?? null
      : null
  );
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(
    questions[initialQuestionIndex]
      ? Boolean(initialAnswers?.[questions[initialQuestionIndex].id])
      : false
  );
  const questionStartedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    questionStartedAtRef.current = Date.now();
  }, [index]);

  const question = questions[index];

  if (!question) {
    return <div>No questions.</div>;
  }

  const options = [
    { key: "A", text: question.option_a },
    { key: "B", text: question.option_b },
    { key: "C", text: question.option_c },
    { key: "D", text: question.option_d },
  ];

  const isCorrect =
    submitted && question.correct_option
      ? selected === question.correct_option
      : null;

  async function submitAnswer() {
    if (!selected) return;

    setSaving(true);

    try {
      const durationSec = Math.max(
        1,
        Math.round((Date.now() - questionStartedAtRef.current) / 1000)
      );

      await fetch("/api/lesson/save-question-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          lessonId,
          questionId: question.id,
          selectedOption: selected,
          skill: question.question_type,
        }),
      });

      await fetch("/api/question-attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          lessonId,
          questionId: question.id,
          selectedOption: selected,
          durationSec,
        }),
      });

      setSubmitted(true);
      onProgressChange?.((prev) => ({
        totalQuestions: prev.totalQuestions,
        answeredQuestions: Math.max(prev.answeredQuestions, index + 1),
      }));
    } catch (error) {
      console.error("submit answer error", error);
      alert("Failed to save answer");
    } finally {
      setSaving(false);
    }
  }

  async function next() {
    if (index >= questions.length - 1) {
      setSaving(true);

      try {
        await fetch("/api/lesson/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId, lessonId }),
        });

        onFinished?.();
      } catch (error) {
        console.error("complete lesson error", error);
        alert("Failed to complete lesson");
      } finally {
        setSaving(false);
      }

      return;
    }

    const nextIndex = index + 1;
    const nextQuestion = questions[nextIndex];

    setIndex(nextIndex);
    setSelected(nextQuestion ? initialAnswers?.[nextQuestion.id] ?? null : null);
    setSubmitted(nextQuestion ? Boolean(initialAnswers?.[nextQuestion.id]) : false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-gray-500">
          Question {index + 1} of {questions.length}
        </div>
        <div className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">
          {question.question_type}
        </div>
      </div>

      <div className="text-lg font-semibold">{question.question_text}</div>

      <div className="grid gap-2">
        {options.map((option) => {
          const isPicked = selected === option.key;
          const showCorrect = submitted && question.correct_option === option.key;
          const showWrong = submitted && isPicked && question.correct_option !== option.key;

          return (
            <button
              key={option.key}
              onClick={() => {
                if (submitted) return;
                setSelected(option.key);
              }}
              className={`text-left border rounded-xl px-4 py-3 ${
                showCorrect
                  ? "border-green-600 bg-green-50"
                  : showWrong
                  ? "border-red-600 bg-red-50"
                  : isPicked
                  ? "border-black bg-gray-100"
                  : "bg-white"
              }`}
            >
              <span className="font-semibold mr-2">{option.key}.</span>
              {option.text}
            </button>
          );
        })}
      </div>

      {!submitted ? (
        <button
          onClick={submitAnswer}
          disabled={!selected || saving}
          className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50"
        >
          {saving ? "Saving..." : "Submit Answer"}
        </button>
      ) : (
        <div className="space-y-4">
          <div
            className={`rounded-xl p-4 ${
              isCorrect ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
            }`}
          >
            <div className="font-semibold mb-2">
              {isCorrect ? "Correct" : "Not quite"}
            </div>

            {question.correct_option ? (
              <div className="text-sm mb-2">
                Correct answer: <span className="font-semibold">{question.correct_option}</span>
              </div>
            ) : null}

            {question.explanation ? (
              <div className="text-sm text-slate-700 whitespace-pre-wrap">
                {question.explanation}
              </div>
            ) : null}
          </div>

          <button
            onClick={next}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50"
          >
            {index >= questions.length - 1 ? "Finish Lesson" : "Next"}
          </button>
        </div>
      )}
    </div>
  );
}
