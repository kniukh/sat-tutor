"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { studentMistakeBrainPath, studentVocabularyPath } from "@/lib/routes/student";
import { persistExerciseAttempt } from "@/services/vocabulary/exercise-attempt-client.service";
import type {
  MistakeReplayItem,
  MistakeReplaySessionData,
  MistakeReplayVocabularyItem,
} from "@/services/analytics/mistake-replay.service";
import type { SupportedVocabExercise } from "@/types/vocab-exercises";

type ReplayStage = "snapshot" | "explanation" | "retry" | "feedback";
type ReplayOptionKey = "A" | "B" | "C" | "D";

type QuestionReasoningExplanation = {
  correct_answer: {
    option: ReplayOptionKey;
    text: string;
  };
  why_correct: string;
  why_others_wrong: Array<{
    option: ReplayOptionKey;
    text: string;
    reason: string;
  }>;
  thinking_tip: string;
};

function buildReplayExercise(item: MistakeReplayVocabularyItem): SupportedVocabExercise {
  return {
    id: item.retry.exerciseId,
    type: item.retry.exerciseType,
    prompt: item.retry.prompt,
    question_text: item.retry.questionText,
    questionText: item.retry.questionText,
    options: item.retry.options.map((option) => ({
      id: option.key,
      label: option.text,
    })),
    distractors: item.retry.options
      .filter((option) => option.key !== item.retry.correctOption)
      .map((option) => option.text),
    correct_answer: item.retry.correctOption,
    correctAnswer: item.retry.correctOption,
    drill_correct_answer: item.retry.correctAnswerLabel,
    drillCorrectAnswer: item.retry.correctAnswerLabel,
    target_word: item.retry.targetWord,
    targetWord: item.retry.targetWord,
    target_word_id: item.retry.targetWordId ?? undefined,
    targetWordId: item.retry.targetWordId ?? undefined,
    explanation: `"${item.retry.targetWord}" fits here as ${item.retry.correctAnswerLabel}.`,
    skill: item.snapshot.exerciseType,
    modality: "text",
    reviewMeta: {
      lifecycleState: item.retry.lifecycleState,
      consecutiveIncorrect: item.retry.consecutiveIncorrect,
      masteryScore: item.retry.masteryScore,
      sourceLessonId: item.retry.lessonId,
      sessionPhase: "priority_review",
    },
  } as SupportedVocabExercise;
}

export default function MistakeReplayPlayer({
  data,
}: {
  data: MistakeReplaySessionData;
}) {
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<ReplayStage>("snapshot");
  const [selectedOption, setSelectedOption] = useState<ReplayOptionKey | null>(null);
  const [feedbackCorrect, setFeedbackCorrect] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [readingExplanationCache, setReadingExplanationCache] = useState<
    Record<string, QuestionReasoningExplanation | undefined>
  >({});
  const [readingExplanationError, setReadingExplanationError] = useState<
    Record<string, string | undefined>
  >({});
  const [readingExplanationLoadingFor, setReadingExplanationLoadingFor] = useState<string | null>(
    null
  );
  const retryStartedAtRef = useRef<number>(Date.now());

  const item = data.items[index] ?? null;

  useEffect(() => {
    setStage("snapshot");
    setSelectedOption(null);
    setFeedbackCorrect(null);
    retryStartedAtRef.current = Date.now();
  }, [index]);

  const progressPercent = data.session.itemCount > 0 ? ((index + 1) / data.session.itemCount) * 100 : 0;
  const currentReadingExplanation =
    item?.kind === "reading" ? readingExplanationCache[item.id] : undefined;
  const currentReadingExplanationError =
    item?.kind === "reading" ? readingExplanationError[item.id] : undefined;

  const retryOptions = useMemo(() => {
    if (!item) {
      return [];
    }

    return item.kind === "reading" ? item.retry.options : item.retry.options;
  }, [item]);

  async function openExplanationStage() {
    if (!item) {
      return;
    }

    setStage("explanation");

    if (item.kind !== "reading") {
      return;
    }

    if (readingExplanationCache[item.id] || readingExplanationLoadingFor === item.id) {
      return;
    }

    setReadingExplanationLoadingFor(item.id);
    setReadingExplanationError((current) => ({ ...current, [item.id]: undefined }));

    try {
      const response = await fetch("/api/question-explanation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passageText: item.retry.passageText,
          questionText: item.retry.questionText,
          correctOption: item.retry.correctOption,
          questionExplanation: item.explanationSeed,
          options: item.retry.options.map((option) => ({
            option: option.key,
            text: option.text,
          })),
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Explanation unavailable");
      }

      setReadingExplanationCache((current) => ({
        ...current,
        [item.id]: payload?.data,
      }));
    } catch (error) {
      setReadingExplanationError((current) => ({
        ...current,
        [item.id]:
          error instanceof Error ? error.message : "Explanation unavailable right now.",
      }));
    } finally {
      setReadingExplanationLoadingFor((current) => (current === item.id ? null : current));
    }
  }

  async function submitRetry() {
    if (!item || !selectedOption) {
      return;
    }

    setSubmitting(true);

    try {
      const isCorrect =
        item.kind === "reading"
          ? selectedOption === item.retry.correctOption
          : selectedOption === item.retry.correctOption;

      if (item.kind === "reading") {
        const durationSec = Math.max(1, Math.round((Date.now() - retryStartedAtRef.current) / 1000));
        await fetch("/api/question-attempt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: data.student.id,
            lessonId: item.lessonId,
            questionId: item.retry.questionId,
            selectedOption,
            durationSec,
          }),
        });
      } else {
        const exercise = buildReplayExercise(item);
        await persistExerciseAttempt({
          studentId: data.student.id,
          exercise,
          result: {
            response_time_ms: Math.max(400, Date.now() - retryStartedAtRef.current),
            session_id: item.retry.sessionId,
            exercise_id: item.retry.exerciseId,
            exercise_type: item.retry.exerciseType,
            target_word_id: item.retry.targetWordId ?? "",
            target_word: item.retry.targetWord,
            selected_answer: selectedOption,
            correct_answer: item.retry.correctOption,
            is_correct: isCorrect,
            attempt_index: 1,
            word_progress_id: item.retry.wordProgressId,
            metadata: {
              replay_mode: true,
              replay_item_id: item.id,
            },
            user_answer: selectedOption,
            attempt_count: 1,
            lesson_id: item.retry.lessonId,
            confidence: null,
            created_at: new Date().toISOString(),
          },
        });
      }

      setFeedbackCorrect(isCorrect);
      setStage("feedback");
    } catch (error) {
      console.error("Failed to save replay attempt", error);
      setFeedbackCorrect(
        item.kind === "reading"
          ? selectedOption === item.retry.correctOption
          : selectedOption === item.retry.correctOption
      );
      setStage("feedback");
    } finally {
      setSubmitting(false);
    }
  }

  function goToNext() {
    if (index >= data.items.length - 1) {
      return;
    }

    setIndex((current) => current + 1);
  }

  if (!item) {
    return (
      <div className="content-shell max-w-3xl">
        <div className="card-surface p-6 text-center">
          <div className="app-heading-md">No replay items ready yet</div>
          <p className="mt-3 app-copy">
            New replay sets appear after mistakes build into a clear repair pattern.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href={studentMistakeBrainPath()} className="primary-button">
              Back to Insights
            </Link>
            <Link href={studentVocabularyPath()} className="secondary-button">
              Open Vocabulary
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isLastItem = index >= data.items.length - 1;

  return (
    <div className="mx-auto flex min-h-[100svh] w-full max-w-3xl flex-col px-4 pb-32 pt-4 sm:px-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 text-sm font-medium text-slate-600">
          <span>{`Replay ${index + 1} of ${data.items.length}`}</span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
            {item.patternLabel}
          </span>
        </div>

        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className="mt-6 flex-1 space-y-5">
        {stage === "snapshot" ? (
          <div className="space-y-5">
            <div className="drill-question">You missed this.</div>

            {item.kind === "reading" ? (
              <>
                <div className="card-surface p-5">
                  <div className="text-base font-semibold leading-7 text-slate-950">
                    {item.snapshot.questionText}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.35rem] border border-rose-200 bg-rose-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700">
                      Your choice
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-950">
                      {item.snapshot.selectedOptionKey ? `${item.snapshot.selectedOptionKey}. ` : ""}
                      {item.snapshot.selectedOptionText ?? "No answer recorded"}
                    </div>
                  </div>
                  <div className="rounded-[1.35rem] border border-emerald-200 bg-emerald-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                      Better answer
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-950">
                      {item.snapshot.correctOptionKey}. {item.snapshot.correctOptionText}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="card-surface p-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Target word
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950">{item.snapshot.word}</div>
                  {item.snapshot.contextText ? (
                    <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                      {item.snapshot.contextText}
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.35rem] border border-rose-200 bg-rose-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700">
                      Your choice
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-950">
                      {item.snapshot.selectedAnswer ?? "No answer recorded"}
                    </div>
                  </div>
                  <div className="rounded-[1.35rem] border border-emerald-200 bg-emerald-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                      Better answer
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-950">
                      {item.snapshot.correctAnswer}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : null}

        {stage === "explanation" ? (
          <div className="space-y-4">
            <div className="drill-question">Why it was wrong.</div>

            {item.kind === "reading" ? (
              readingExplanationLoadingFor === item.id ? (
                <div className="card-surface p-5 text-sm text-slate-600">
                  Building a short reasoning guide...
                </div>
              ) : currentReadingExplanation ? (
                <div className="space-y-3">
                  <div className="card-surface p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Correct answer
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-950">
                      {currentReadingExplanation.correct_answer.option}.{" "}
                      {currentReadingExplanation.correct_answer.text}
                    </div>
                  </div>

                  <div className="card-surface p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Why it works
                    </div>
                    <div className="mt-2 text-sm leading-6 text-slate-700">
                      {currentReadingExplanation.why_correct}
                    </div>
                  </div>

                  <div className="card-surface p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Trap to avoid
                    </div>
                    <div className="mt-2 text-sm leading-6 text-slate-700">
                      {currentReadingExplanation.why_others_wrong.find(
                        (entry) => entry.option === item.snapshot.selectedOptionKey
                      )?.reason ??
                        currentReadingExplanation.why_others_wrong[0]?.reason ??
                        "The wrong choice missed the passage's actual point."}
                    </div>
                  </div>

                  <div className="card-surface p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Thinking tip
                    </div>
                    <div className="mt-2 text-sm leading-6 text-slate-700">
                      {currentReadingExplanation.thinking_tip}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="card-surface p-5 text-sm text-slate-600">
                  {currentReadingExplanationError || "Explanation unavailable right now."}
                </div>
              )
            ) : (
              <div className="space-y-3">
                <div className="card-surface p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Correct answer
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-950">
                    {item.explanation.correctAnswer}
                  </div>
                </div>
                <div className="card-surface p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Why it works
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-700">
                    {item.explanation.whyCorrect}
                  </div>
                </div>
                <div className="card-surface p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    What went wrong
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-700">
                    {item.explanation.whyWrong}
                  </div>
                </div>
                <div className="card-surface p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Thinking tip
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-700">
                    {item.explanation.thinkingTip}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {stage === "retry" ? (
          <div className="space-y-5">
            <div className="drill-question">
              {item.kind === "reading" ? "Try it again." : "Try a similar repair question."}
            </div>

            {item.kind === "vocabulary" && item.snapshot.contextText ? (
              <div className="drill-context-surface">
                <div className="drill-context-inline">{item.snapshot.contextText}</div>
              </div>
            ) : null}

            <div className="px-1 text-base font-semibold leading-7 text-slate-950">
              {item.kind === "reading" ? item.retry.questionText : item.retry.questionText}
            </div>

            <div className="grid gap-3">
              {retryOptions.map((option) => {
                const optionState =
                  selectedOption === option.key ? "selected" : "idle";

                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setSelectedOption(option.key)}
                    data-state={optionState}
                    className="drill-option min-h-16"
                  >
                    <div className="flex items-start gap-3">
                      <div className="drill-option-indicator mt-0.5">{option.key}</div>
                      <div className="flex-1 text-[0.98rem] leading-7 text-inherit sm:text-[1.05rem] sm:leading-8">
                        {option.text}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {stage === "feedback" ? (
          <div className="space-y-4">
            <div className="drill-question">
              {feedbackCorrect ? "Good repair." : "One more thing to notice."}
            </div>

            <div
              className={`rounded-[1.35rem] border px-4 py-4 ${
                feedbackCorrect
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-amber-200 bg-amber-50"
              }`}
            >
              <div className="text-sm font-semibold text-slate-950">
                {feedbackCorrect ? "You corrected the pattern." : "The right answer is still the safer choice."}
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-700">
                {item.kind === "reading"
                  ? `Keep anchoring your choice to the full passage, not the most tempting keyword.`
                  : `Remember: "${item.retry.targetWord}" works here as ${item.retry.correctAnswerLabel}.`}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="fixed-action-bar">
        <div className="fixed-action-bar__inner flex items-center gap-3">
          {stage === "snapshot" ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setStage("retry");
                  retryStartedAtRef.current = Date.now();
                }}
                className="secondary-button min-h-14 px-5"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={openExplanationStage}
                className="primary-button min-h-14 flex-1"
              >
                Why it was wrong
              </button>
            </>
          ) : null}

          {stage === "explanation" ? (
            <button
              type="button"
              onClick={() => {
                setStage("retry");
                retryStartedAtRef.current = Date.now();
              }}
              className="primary-button min-h-14 w-full"
            >
              Try Again
            </button>
          ) : null}

          {stage === "retry" ? (
            <button
              type="button"
              onClick={submitRetry}
              disabled={!selectedOption || submitting}
              className="primary-button min-h-14 w-full disabled:cursor-not-allowed disabled:border disabled:border-slate-200 disabled:bg-slate-300 disabled:text-white"
            >
              {submitting ? "Saving..." : "Submit"}
            </button>
          ) : null}

          {stage === "feedback" ? (
            isLastItem ? (
              <Link
                href={studentMistakeBrainPath()}
                className="primary-button min-h-14 w-full"
              >
                Finish Replay
              </Link>
            ) : (
              <button
                type="button"
                onClick={goToNext}
                className="primary-button min-h-14 w-full"
              >
                Next
              </button>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
