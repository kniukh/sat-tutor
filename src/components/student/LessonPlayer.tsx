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
  passageId?: string;
  questions: Question[];
  passageText?: string;
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
  passageId,
  questions,
  passageText,
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
  const [captureSaving, setCaptureSaving] = useState(false);
  const [captureToast, setCaptureToast] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(
    questions[initialQuestionIndex]
      ? Boolean(initialAnswers?.[questions[initialQuestionIndex].id])
      : false
  );
  const [showPassage, setShowPassage] = useState(false);
  const questionStartedAtRef = useRef<number>(Date.now());
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function normalizeCaptureWord(word: string) {
    return word
      .toLowerCase()
      .replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, "")
      .trim();
  }

  function buildSnippet(fullText: string, itemText: string) {
    const lowerText = fullText.toLowerCase();
    const lowerItem = itemText.toLowerCase();
    const index = lowerText.indexOf(lowerItem);

    if (index === -1) {
      return fullText.trim().slice(0, 180);
    }

    const start = Math.max(0, index - 80);
    const end = Math.min(fullText.length, index + itemText.length + 80);
    return fullText.slice(start, end).trim();
  }

  async function captureWordFromLessonContext(
    rawWord: string,
    sourceType: "question" | "answer",
    sourceText: string
  ) {
    const itemText = normalizeCaptureWord(rawWord);
    if (!itemText) {
      return;
    }

    setCaptureSaving(true);

    try {
      await fetch("/api/vocabulary/capture-inline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          lessonId,
          passageId,
          itemText,
          itemType: "word",
          sourceType,
          contextText: buildSnippet(sourceText, rawWord),
        }),
      });

      setCaptureToast(itemText);
      window.setTimeout(() => {
        setCaptureToast((current) => (current === itemText ? null : current));
      }, 1600);
    } catch (error) {
      console.error("capture word from lesson context error", error);
    } finally {
      setCaptureSaving(false);
    }
  }

  function clearLongPress() {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  }

  function startLongPress(
    rawWord: string,
    sourceType: "question" | "answer",
    sourceText: string
  ) {
    clearLongPress();
    longPressTimeoutRef.current = setTimeout(() => {
      void captureWordFromLessonContext(rawWord, sourceType, sourceText);
    }, 420);
  }

  function renderCaptureableText(
    text: string,
    sourceType: "question" | "answer",
    className?: string
  ) {
    return (
      <span className={className}>
        {text.split(/(\s+)/g).map((token, index) => {
          const normalized = normalizeCaptureWord(token);

          if (!normalized) {
            return <span key={`${sourceType}-${index}`}>{token}</span>;
          }

          return (
            <span
              key={`${sourceType}-${index}-${token}`}
              onTouchStart={() => startLongPress(token, sourceType, text)}
              onTouchEnd={clearLongPress}
              onTouchMove={clearLongPress}
              onTouchCancel={clearLongPress}
            >
              {token}
            </span>
          );
        })}
      </span>
    );
  }

  useEffect(() => {
    questionStartedAtRef.current = Date.now();
  }, [index]);

  const question = questions[index];

  if (!question) {
    return <div>No questions.</div>;
  }

  if (showPassage) {
    return (
      <div className="space-y-4 rounded-[28px] border border-slate-200 bg-white px-4 py-5 shadow-sm sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-900">Passage</div>
          <button
            type="button"
            onClick={() => setShowPassage(false)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
          >
            Back to Question
          </button>
        </div>

        <div className="whitespace-pre-wrap text-[18px] leading-8 text-slate-900 sm:text-[19px] sm:leading-9">
          {passageText || "Passage unavailable for this question."}
        </div>
      </div>
    );
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
    <div className="space-y-4 rounded-[28px] border border-slate-200 bg-white px-4 py-5 shadow-sm sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-gray-500">
          Question {index + 1} of {questions.length}
        </div>
        <div className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">
          {question.question_type}
        </div>
      </div>

      <div className="text-xl font-semibold leading-8 text-slate-950">
        {renderCaptureableText(question.question_text, "question")}
      </div>

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
              {renderCaptureableText(option.text, "answer")}
            </button>
          );
        })}
      </div>

      {!submitted ? (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setShowPassage(true)}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            See Passage
          </button>
          <button
            onClick={submitAnswer}
            disabled={!selected || saving}
            className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Submit Answer"}
          </button>
        </div>
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

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowPassage(true)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              See Passage
            </button>
            <button
              onClick={next}
              disabled={saving}
              className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
            >
              {index >= questions.length - 1 ? "Finish Lesson" : "Next"}
            </button>
          </div>
        </div>
      )}

      {captureToast ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {captureSaving ? `Saving "${captureToast}"...` : `Added "${captureToast}" to vocabulary.`}
        </div>
      ) : null}
    </div>
  );
}
