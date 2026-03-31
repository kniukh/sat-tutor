"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import InteractivePassageReader from "./InteractivePassageReader";

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

type KnownWord = {
  id: string;
  item_text: string;
  lifecycle_state?: string | null;
  review_bucket?: "recently_failed" | "weak_again" | "overdue" | "reinforcement" | "scheduled" | null;
  review_ready?: boolean;
};

type LessonCompletionPayload = {
  vocabularyPreparation?: {
    generatedCount?: number;
    preparedCount?: number;
    totalItems?: number;
  } | null;
} | null;

type QuestionReasoningExplanation = {
  correct_answer: {
    option: "A" | "B" | "C" | "D";
    text: string;
  };
  why_correct: string;
  why_others_wrong: Array<{
    option: "A" | "B" | "C" | "D";
    text: string;
    reason: string;
  }>;
  thinking_tip: string;
};

type Props = {
  studentId: string;
  lessonId: string;
  passageId?: string;
  questions: Question[];
  passageText?: string;
  knownWords?: KnownWord[];
  onFinished?: (result: LessonCompletionPayload) => void;
  onProgressChange?: Dispatch<
    SetStateAction<{
      totalQuestions: number;
      answeredQuestions: number;
    }>
  >;
  initialAnswers?: Record<string, "A" | "B" | "C" | "D">;
  initialQuestionIndex?: number;
};

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

export default function LessonPlayer({
  studentId,
  lessonId,
  passageId,
  questions,
  passageText,
  knownWords = [],
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
  const [showExplanationSheet, setShowExplanationSheet] = useState(false);
  const [explanationCache, setExplanationCache] = useState<
    Record<string, QuestionReasoningExplanation | undefined>
  >({});
  const [explanationLoadingFor, setExplanationLoadingFor] = useState<string | null>(null);
  const [explanationErrorFor, setExplanationErrorFor] = useState<Record<string, string | undefined>>(
    {}
  );
  const questionStartedAtRef = useRef<number>(Date.now());
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const knownWordsMapRef = useRef<Map<string, KnownWord>>(new Map());

  useEffect(() => {
    const nextMap = new Map<string, KnownWord>();
    for (const item of knownWords) {
      const normalized = normalizeCaptureWord(item.item_text);
      if (!normalized || nextMap.has(normalized)) {
        continue;
      }

      nextMap.set(normalized, item);
    }
    knownWordsMapRef.current = nextMap;
  }, [knownWords]);

  useEffect(() => {
    questionStartedAtRef.current = Date.now();
  }, [index]);

  useEffect(() => {
    setShowExplanationSheet(false);
  }, [index]);

  useEffect(() => {
    return () => {
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
      }
    };
  }, []);

  const question = questions[index];

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
        {text.split(/(\s+)/g).map((token, tokenIndex) => {
          const normalized = normalizeCaptureWord(token);

          if (!normalized) {
            return <span key={`${sourceType}-${tokenIndex}`}>{token}</span>;
          }

          const knownWord = knownWordsMapRef.current.get(normalized);
          const knownWordClassName = knownWord
            ? knownWord.review_ready || knownWord.review_bucket === "weak_again"
              ? "rounded-md bg-amber-100/75 px-0.5 underline decoration-amber-500 decoration-2 underline-offset-4"
              : knownWord.review_bucket === "recently_failed"
                ? "rounded-md bg-rose-100/75 px-0.5 underline decoration-rose-500 decoration-2 underline-offset-4"
                : "rounded-md bg-sky-100/75 px-0.5 underline decoration-sky-500 decoration-2 underline-offset-4"
            : null;

          return (
            <span
              key={`${sourceType}-${tokenIndex}-${token}`}
              className={knownWordClassName ?? undefined}
              onTouchStart={
                knownWord ? undefined : () => startLongPress(token, sourceType, text)
              }
              onTouchEnd={knownWord ? undefined : clearLongPress}
              onTouchMove={knownWord ? undefined : clearLongPress}
              onTouchCancel={knownWord ? undefined : clearLongPress}
            >
              {token}
            </span>
          );
        })}
      </span>
    );
  }

  if (!question) {
    return <div className="text-sm text-slate-600">No questions available.</div>;
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
  const progressPercent = ((index + 1) / Math.max(questions.length, 1)) * 100;

  async function submitAnswer() {
    if (!selected) {
      return;
    }

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
        const response = await fetch("/api/lesson/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId, lessonId }),
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.error ?? "Failed to complete lesson");
        }

        onFinished?.(payload?.result ?? null);
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

  async function openExplanation() {
    if (!submitted || !question?.correct_option) {
      return;
    }

    setShowExplanationSheet(true);

    if (explanationCache[question.id] || explanationLoadingFor === question.id) {
      return;
    }

    setExplanationLoadingFor(question.id);
    setExplanationErrorFor((current) => ({ ...current, [question.id]: undefined }));

    try {
      const response = await fetch("/api/question-explanation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passageText: passageText || "",
          questionText: question.question_text,
          correctOption: question.correct_option,
          questionExplanation: question.explanation ?? null,
          options: options.map((option) => ({
            option: option.key,
            text: option.text,
          })),
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Explanation unavailable");
      }

      setExplanationCache((current) => ({
        ...current,
        [question.id]: payload?.data,
      }));
    } catch (error) {
      setExplanationErrorFor((current) => ({
        ...current,
        [question.id]:
          error instanceof Error ? error.message : "Explanation unavailable right now.",
      }));
    } finally {
      setExplanationLoadingFor((current) => (current === question.id ? null : current));
    }
  }

  const currentExplanation = explanationCache[question.id];
  const currentExplanationError = explanationErrorFor[question.id];

  return (
    <div className="relative flex min-h-full flex-1 flex-col pb-32">
      {showPassage ? (
        <div className="fixed inset-0 z-40 bg-[#fbf7ee]/98 backdrop-blur-sm">
          <div className="mx-auto flex h-full w-full max-w-4xl flex-col">
            <div className="reading-topbar">
              <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
                <div className="text-sm font-medium text-slate-700">Passage</div>
                <button
                  type="button"
                  onClick={() => setShowPassage(false)}
                  className="secondary-button"
                >
                  Back to Question
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
              <div className="reading-surface px-5 py-7 sm:px-8 sm:py-9">
                <InteractivePassageReader
                  studentId={studentId}
                  lessonId={lessonId}
                  passageId={passageId}
                  passageText={passageText || "Passage unavailable for this question."}
                  knownWords={knownWords}
                  mode="capture"
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showExplanationSheet ? (
        <div className="fixed inset-0 z-50 bg-slate-950/22 backdrop-blur-[2px]">
          <button
            type="button"
            aria-label="Close explanation"
            onClick={() => setShowExplanationSheet(false)}
            className="absolute inset-0 h-full w-full"
          />

          <div className="absolute inset-x-0 bottom-0">
            <div className="mx-auto w-full max-w-3xl rounded-t-[2rem] border border-slate-200 bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-4 shadow-2xl sm:px-6">
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200" />

              <div className="flex items-center justify-between gap-3">
                <div className="text-base font-semibold text-slate-950">Why this answer works</div>
                <button
                  type="button"
                  onClick={() => setShowExplanationSheet(false)}
                  className="secondary-button min-h-10 px-4 text-sm"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 space-y-4 text-sm leading-6 text-slate-700">
                {explanationLoadingFor === question.id ? (
                  <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50 px-4 py-4">
                    Building a quick reasoning guide...
                  </div>
                ) : currentExplanation ? (
                  <>
                    <section className="rounded-[1.35rem] border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Correct answer
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-950">
                        {currentExplanation.correct_answer.option}. {currentExplanation.correct_answer.text}
                      </div>
                    </section>

                    <section className="rounded-[1.35rem] border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Why it is correct
                      </div>
                      <div className="mt-2">{currentExplanation.why_correct}</div>
                    </section>

                    <section className="rounded-[1.35rem] border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Why the other answers are wrong
                      </div>
                      <div className="mt-3 space-y-3">
                        {currentExplanation.why_others_wrong.map((item) => (
                          <div key={item.option} className="rounded-2xl bg-white px-3 py-3">
                            <div className="font-semibold text-slate-950">
                              {item.option}. {item.text}
                            </div>
                            <div className="mt-1 text-slate-700">{item.reason}</div>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="rounded-[1.35rem] border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Thinking tip
                      </div>
                      <div className="mt-2">{currentExplanation.thinking_tip}</div>
                    </section>
                  </>
                ) : (
                  <div className="rounded-[1.35rem] border border-rose-200 bg-rose-50 px-4 py-4 text-rose-800">
                    {currentExplanationError || "Explanation unavailable right now."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-5">
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between gap-3 text-sm font-medium text-slate-600">
            <span>{`Question ${index + 1} of ${questions.length}`}</span>
            <button
              type="button"
              onClick={() => setShowPassage(true)}
              className="secondary-button min-h-11 px-4 text-sm"
            >
              See Passage
            </button>
          </div>

          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="px-1">
          <div className="drill-question">
            {renderCaptureableText(question.question_text, "question")}
          </div>
        </div>

        <div className="grid gap-3">
          {options.map((option) => {
            const isPicked = selected === option.key;
            const showCorrect = submitted && question.correct_option === option.key;
            const showWrong = submitted && isPicked && question.correct_option !== option.key;
            const optionState = showCorrect
              ? "correct"
              : showWrong
                ? "incorrect"
                : isPicked
                  ? "selected"
                  : "idle";

            return (
              <button
                key={option.key}
                type="button"
                onClick={() => {
                  if (submitted) {
                    return;
                  }
                  setSelected(option.key);
                }}
                data-state={optionState}
                className="drill-option min-h-16"
              >
                <div className="flex items-start gap-3">
                  <div className="drill-option-indicator mt-0.5">
                    {option.key}
                  </div>
                  <div className="flex-1 text-[0.98rem] leading-7 text-inherit sm:text-[1.05rem] sm:leading-8">
                    {renderCaptureableText(option.text, "answer")}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {submitted ? (
          <div
            className={`rounded-[1.35rem] border px-4 py-4 ${
              isCorrect
                ? "border-emerald-200 bg-emerald-50/80"
                : "border-rose-200 bg-rose-50/80"
            }`}
          >
            <div className="text-sm font-semibold text-slate-950">
              {isCorrect ? "Correct" : "Incorrect"}
            </div>
          </div>
        ) : null}
      </div>

      <div className="fixed-action-bar">
        <div className="fixed-action-bar__inner flex items-center gap-3">
          {submitted ? (
            <button
              type="button"
              onClick={openExplanation}
              className="secondary-button min-h-14 px-5"
            >
              Why?
            </button>
          ) : null}
          <button
            type="button"
            onClick={submitted ? next : submitAnswer}
            disabled={submitted ? saving : !selected || saving}
            className="primary-button min-h-14 flex-1 disabled:cursor-not-allowed disabled:border disabled:border-slate-200 disabled:bg-slate-300 disabled:text-white"
          >
            {saving
              ? "Saving..."
              : submitted
                ? index >= questions.length - 1
                  ? "Finish Lesson"
                  : "Continue"
                : "Submit"}
          </button>
        </div>
      </div>

      {captureToast ? (
        <div className="pointer-events-none fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+6rem)] z-30 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white shadow-xl sm:left-auto sm:right-6 sm:max-w-sm">
          {captureSaving ? `Saving "${captureToast}"...` : `Added "${captureToast}" to vocabulary.`}
        </div>
      ) : null}
    </div>
  );
}
