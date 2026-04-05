"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getExerciseAcceptableAnswers,
  getExerciseAudioStatus,
  getExerciseAudioUrl,
  getExerciseCorrectAnswer,
  getExerciseCorrectSequence,
  getExerciseModality,
  getExercisePairLeftId,
  getExercisePairRightId,
  getExercisePairs,
  getExerciseQuestionText,
  getExerciseSentenceText,
  getExerciseTargetWord,
  getExerciseTargetWordId,
} from "@/types/vocab-exercises";
import ExercisePlayerFooter from "./ExercisePlayerFooter";
import ExerciseProgressHeader from "./ExerciseProgressHeader";
import type { Exercise, ExerciseResult } from "./types";
import MeaningMatchExercise from "./renderers/MeaningMatchExercise";
import PairMatchExercise from "./renderers/PairMatchExercise";
import ListenMatchExercise from "./renderers/ListenMatchExercise";
import SpellingFromAudioExercise from "./renderers/SpellingFromAudioExercise";
import SentenceBuilderExercise from "./renderers/SentenceBuilderExercise";
import ErrorDetectionExercise from "./renderers/ErrorDetectionExercise";
import FillBlankExercise from "./renderers/FillBlankExercise";
import ContextMeaningExercise from "./renderers/ContextMeaningExercise";
import SynonymExercise from "./renderers/SynonymExercise";
import CollocationExercise from "./renderers/CollocationExercise";
import {
  getAnswerFeedbackCue,
  primeFeedbackAudio,
  triggerFeedbackCue,
} from "@/services/feedback/feedback-effects.client";
import { useFeedbackSettings } from "@/services/feedback/use-feedback-settings";
import InlineVocabularyCaptureText from "../InlineVocabularyCaptureText";

type Props = {
  exercises: Exercise[];
  title?: string;
  sessionId?: string;
  sessionMetadata?: Record<string, unknown>;
  focused?: boolean;
  captureStudentId?: string;
  captureLessonId?: string | null;
  comboCount?: number;
  floatingReward?: {
    id: string;
    xp: number;
    comboCount: number;
    comboMultiplier: number;
    leveledUp: boolean;
  } | null;
  onExerciseComplete?: (result: ExerciseResult) => void;
  onComplete?: (results: ExerciseResult[]) => void;
};

type ExerciseFeedbackState = {
  isCorrect: boolean;
  explanation?: string;
  selectedAnswer?: string;
  correctAnswer?: string;
  answerLabel?: string;
  streakCount?: number;
};

function parseSentenceBuilderResponse(value: string) {
  if (!value.trim()) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function parsePairMatchResponse(value: string) {
  if (!value.trim()) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function sortPairMatchKeys(pairKeys: string[]) {
  return [...pairKeys].sort((left, right) => left.localeCompare(right));
}

function getRetrySourceExerciseId(exercise: Exercise) {
  const metadata = exercise.metadata as
    | {
        retry_source_exercise_id?: unknown;
      }
    | undefined;

  return typeof metadata?.retry_source_exercise_id === "string"
    ? metadata.retry_source_exercise_id
    : null;
}

function canQueueRetryExercise(exercise: Exercise) {
  if (exercise.type === "pair_match" || exercise.type === "listen_match") {
    return false;
  }

  return getRetrySourceExerciseId(exercise) === null;
}

function buildRetryExercise(exercise: Exercise): Exercise {
  return {
    ...exercise,
    id: `${exercise.id}:retry`,
    metadata: {
      ...(exercise.metadata ?? {}),
      retry_source_exercise_id: exercise.id,
      retry_pass: 1,
    },
  };
}

export default function ExercisePlayer({
  exercises,
  sessionId,
  sessionMetadata,
  focused = false,
  captureStudentId,
  captureLessonId = null,
  comboCount = 0,
  floatingReward = null,
  onExerciseComplete,
  onComplete,
}: Props) {
  const sessionIdRef = useRef<string>(
    sessionId ??
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `session-${Date.now()}`)
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [exerciseQueue, setExerciseQueue] = useState<Exercise[]>(exercises);
  const [responseValue, setResponseValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<ExerciseResult[]>([]);
  const [captureToast, setCaptureToast] = useState<string | null>(null);
  const [currentFeedback, setCurrentFeedback] = useState<ExerciseFeedbackState | null>(null);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const startedAtRef = useRef<number>(Date.now());
  const autoAdvanceTimeoutRef = useRef<number | null>(null);
  const { settings: feedbackSettings } = useFeedbackSettings();

  useEffect(() => {
    setExerciseQueue(exercises);
    setCurrentIndex(0);
    setResponseValue("");
    setSubmitted(false);
    setResults([]);
    setCurrentFeedback(null);
    setIsAdvancing(false);
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
  }, [exercises]);

  const currentExercise = exerciseQueue[currentIndex] ?? null;
  const questionText = currentExercise ? getExerciseQuestionText(currentExercise) : "";
  const captureContextLessonId =
    currentExercise?.reviewMeta?.sourceLessonId ?? captureLessonId ?? null;

  useEffect(() => {
    startedAtRef.current = Date.now();
    setIsAdvancing(false);
  }, [currentIndex]);

  useEffect(() => {
    primeFeedbackAudio();
  }, []);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
      }
    };
  }, []);

  const currentStreak = useMemo(() => {
    let streak = 0;

    for (let index = results.length - 1; index >= 0; index -= 1) {
      if (!results[index]?.is_correct) {
        break;
      }

      streak += 1;
    }

    return streak;
  }, [results]);

  if (!currentExercise) {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-slate-600 shadow-sm sm:p-7">
          No exercises available yet.
      </div>
    );
  }

  const isTypedResponse = currentExercise.type === "spelling_from_audio";
  const isPairMatch = currentExercise.type === "pair_match";
  const isListenPairMatch =
    currentExercise.type === "listen_match" && getExercisePairs(currentExercise).length > 1;
  const isPairStyleExercise = isPairMatch || isListenPairMatch;
  const isSentenceBuilder = currentExercise.type === "sentence_builder";
  const selectedPairKeys = isPairStyleExercise ? parsePairMatchResponse(responseValue) : [];
  const selectedTileIds = isSentenceBuilder
    ? parseSentenceBuilderResponse(responseValue)
    : [];
  const pairCount = isPairStyleExercise ? getExercisePairs(currentExercise).length : 0;
  const canSubmit = isPairStyleExercise
    ? pairCount > 0 && selectedPairKeys.length === pairCount
    : isSentenceBuilder
      ? selectedTileIds.length > 0
      : Boolean(responseValue.trim());

  useEffect(() => {
    function handleSessionKeyDown(event: KeyboardEvent) {
      if (!currentExercise || event.defaultPrevented || event.isComposing) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName ?? "";
      const isInputLike =
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        target?.getAttribute("contenteditable") === "true";
      const isButton = tagName === "BUTTON";

      if (submitted) {
        return;
      }

      if (
        !isInputLike &&
        !isButton &&
        !isTypedResponse &&
        !isPairStyleExercise &&
        !isSentenceBuilder &&
        /^[1-9]$/.test(event.key)
      ) {
        const optionIndex = Number(event.key) - 1;
        const option = currentExercise.options[optionIndex];

        if (option) {
          event.preventDefault();
          setResponseValue(option.id);
        }
        return;
      }

      if (event.key === "Enter" && canSubmit && !isButton) {
        event.preventDefault();
        handleContinue();
      }
    }

    window.addEventListener("keydown", handleSessionKeyDown);
    return () => window.removeEventListener("keydown", handleSessionKeyDown);
  }, [
    canSubmit,
    currentExercise,
    isPairStyleExercise,
    isSentenceBuilder,
    isTypedResponse,
    submitted,
    responseValue,
    currentIndex,
    results,
    currentFeedback,
  ]);

  function handleContinue() {
    if (submitted || isAdvancing) {
      return;
    }

    if (!canSubmit || isAdvancing) return;

    const timeSpentMs = Math.max(1, Date.now() - startedAtRef.current);
    const correctAnswerId = getExerciseCorrectAnswer(currentExercise);
    const questionText = getExerciseQuestionText(currentExercise);
    const selectedOption = isTypedResponse
      ? null
      : isPairStyleExercise
        ? null
      : isSentenceBuilder
        ? null
      : currentExercise.options.find((option) => option.id === responseValue) ?? null;
    const correctOption = isTypedResponse
      ? null
      : isPairStyleExercise
        ? null
      : isSentenceBuilder
        ? null
      : currentExercise.options.find((option) => option.id === correctAnswerId) ?? null;
    const correctPairs = isPairStyleExercise
      ? getExercisePairs(currentExercise).map((pair) => ({
          key: `${getExercisePairLeftId(pair)}::${getExercisePairRightId(pair)}`,
          label: `${pair.left} -> ${pair.right}`,
        }))
      : [];
    const selectedPairLabels = isPairStyleExercise
      ? selectedPairKeys.map((pairKey) => {
          const matchingPair = correctPairs.find((pair) => pair.key === pairKey);
          if (matchingPair) {
            return matchingPair.label;
          }

          const [leftId, rightId] = pairKey.split("::");
          const leftLabel =
            currentExercise.options.find((option) => option.id === leftId)?.label ?? leftId;
          const rightLabel =
            currentExercise.options.find((option) => option.id === rightId)?.label ?? rightId;
          return `${leftLabel} -> ${rightLabel}`;
        })
      : [];
    const selectedTileLabels = isSentenceBuilder
      ? selectedTileIds
          .map((tileId) => currentExercise.options.find((option) => option.id === tileId)?.label)
          .filter((label): label is string => Boolean(label))
      : [];
    const builtSentence = isSentenceBuilder ? selectedTileLabels.join(" ") : null;
    const selectedAnswer = isTypedResponse
      ? responseValue.trim()
      : isPairStyleExercise
        ? selectedPairLabels.join(" | ")
      : isSentenceBuilder
        ? builtSentence ?? ""
      : selectedOption?.label ?? responseValue;
    const normalizedTypedAnswer = responseValue.trim().toLowerCase();
    const normalizedAcceptableAnswers = getExerciseAcceptableAnswers(currentExercise).map((answer) =>
      answer.trim().toLowerCase()
    );
    const isCorrect = isTypedResponse
      ? normalizedAcceptableAnswers.includes(normalizedTypedAnswer)
      : isPairStyleExercise
        ? JSON.stringify(sortPairMatchKeys(selectedPairKeys)) ===
          JSON.stringify(sortPairMatchKeys(correctPairs.map((pair) => pair.key)))
      : isSentenceBuilder
        ? JSON.stringify(selectedTileIds) ===
          JSON.stringify(getExerciseCorrectSequence(currentExercise))
      : getExerciseAcceptableAnswers(currentExercise).includes(responseValue);
    const comboCountAfter = isCorrect ? currentStreak + 1 : 0;
    triggerFeedbackCue(
      getAnswerFeedbackCue({
        isCorrect,
        comboCountAfter,
      }),
      feedbackSettings
    );
    const wordProgressId = currentExercise.reviewMeta?.sourceDrillId ?? null;
    const result: ExerciseResult = {
      response_time_ms: timeSpentMs,
      session_id: sessionIdRef.current,
      exercise_id: currentExercise.id,
      exercise_type: currentExercise.type,
      target_word_id: getExerciseTargetWordId(currentExercise),
      target_word: getExerciseTargetWord(currentExercise),
      selected_answer: selectedAnswer,
      correct_answer:
        isTypedResponse
          ? correctAnswerId
          : isPairStyleExercise
            ? correctPairs.map((pair) => pair.label).join(" | ")
            : isSentenceBuilder
              ? correctAnswerId
              : correctOption?.label ?? correctAnswerId,
      is_correct: isCorrect,
      attempt_index: currentIndex + 1,
      word_progress_id: wordProgressId,
      metadata: {
        ...(sessionMetadata ?? {}),
        selected_option_id:
          isTypedResponse || isSentenceBuilder || isPairStyleExercise ? null : responseValue,
        correct_option_id:
          isTypedResponse || isSentenceBuilder || isPairStyleExercise ? null : correctAnswerId,
        response_kind: isTypedResponse
          ? "typed"
          : isPairStyleExercise
            ? "pair_match"
            : isSentenceBuilder
            ? "tile_builder"
            : "option",
        normalized_selected_answer: isSentenceBuilder
          ? (builtSentence ?? "").trim().toLowerCase()
          : normalizedTypedAnswer,
        selected_pairs: isPairStyleExercise ? selectedPairKeys : null,
        correct_pairs: isPairStyleExercise ? correctPairs.map((pair) => pair.key) : null,
        selected_pair_labels: isPairStyleExercise ? selectedPairLabels : null,
        selected_tile_ids: isSentenceBuilder ? selectedTileIds : null,
        selected_tile_labels: isSentenceBuilder ? selectedTileLabels : null,
        correct_tile_ids: isSentenceBuilder ? getExerciseCorrectSequence(currentExercise) : null,
        question_text: questionText,
        sentence_text: getExerciseSentenceText(currentExercise) || null,
        prompt: currentExercise.prompt,
        instructions: currentExercise.instructions ?? null,
        exercise_variant:
          "variant" in currentExercise && typeof currentExercise.variant === "string"
            ? currentExercise.variant
            : null,
        modality: getExerciseModality(currentExercise),
        audio_url: getExerciseAudioUrl(currentExercise),
        audio_status: getExerciseAudioStatus(currentExercise),
        audio_available: Boolean(getExerciseAudioUrl(currentExercise)),
        skill: currentExercise.skill ?? null,
        tags: currentExercise.tags ?? [],
      },
      user_answer: selectedAnswer,
      attempt_count: (currentExercise.reviewMeta?.attemptCount ?? 0) + 1,
      lesson_id: currentExercise.reviewMeta?.sourceLessonId ?? null,
      confidence: null,
      created_at: new Date().toISOString(),
    };

    setSubmitted(true);
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
    }
    setCurrentFeedback({
      isCorrect,
      explanation: currentExercise.explanation,
      selectedAnswer: selectedAnswer,
      correctAnswer: isTypedResponse
        ? correctAnswerId
        : isPairStyleExercise
          ? correctPairs.map((pair) => pair.label).join(" | ")
        : isSentenceBuilder
          ? correctAnswerId
          : correctOption?.label ?? correctAnswerId,
      answerLabel: isTypedResponse
        ? "Your spelling"
        : isPairStyleExercise
          ? "Your matches"
        : isSentenceBuilder
          ? "Your sentence"
          : "Your answer",
      streakCount: isCorrect ? currentStreak + 1 : 0,
    });
    setResults((prev) => [
      ...prev.filter((item) => item.exercise_id !== result.exercise_id),
      result,
    ]);

    if (!isCorrect && canQueueRetryExercise(currentExercise)) {
      setExerciseQueue((current) => [...current, buildRetryExercise(currentExercise)]);
    }

    console.debug("Vocab exercise attempt", result);
    onExerciseComplete?.(result);

    const nextResults = [
      ...results.filter((item) => item.exercise_id !== result.exercise_id),
      result,
    ];
    const queueLengthAfterCheck =
      !isCorrect && canQueueRetryExercise(currentExercise)
        ? exerciseQueue.length + 1
        : exerciseQueue.length;

    autoAdvanceTimeoutRef.current = window.setTimeout(() => {
      if (currentIndex >= queueLengthAfterCheck - 1) {
        onComplete?.(nextResults);
        return;
      }

      setIsAdvancing(true);
      window.setTimeout(() => {
        setCurrentIndex((prev) => prev + 1);
        setResponseValue("");
        setSubmitted(false);
        setCurrentFeedback(null);
      }, 120);
    }, 520);
  }

  function renderExercise() {
    const renderCaptureText = ({
      text,
      contextText,
      isDistractor = false,
      className,
      highlightText,
      as = "span",
    }: {
      text: string;
      contextText?: string | null;
      isDistractor?: boolean;
      className?: string;
      highlightText?: string | null;
      as?: "span" | "div";
    }) =>
      captureStudentId && captureContextLessonId ? (
        <InlineVocabularyCaptureText
          text={text}
          studentId={captureStudentId}
          lessonId={captureContextLessonId}
          sourceType="answer"
          sourceText={contextText ?? questionText ?? text}
          className={className}
          as={as}
          onCaptured={(item) => {
            setCaptureToast(item.itemText);
            window.setTimeout(() => {
              setCaptureToast((current) => (current === item.itemText ? null : current));
            }, 1600);
          }}
        />
      ) : (
        as === "div" ? <div className={className}>{text}</div> : <span className={className}>{text}</span>
      );

    switch (currentExercise.type) {
      case "meaning_match":
      case "translation_match":
        return (
          <MeaningMatchExercise
            exercise={currentExercise}
            selectedValue={responseValue}
            onSelect={setResponseValue}
            submitted={submitted}
            focused={focused}
            feedbackReward={submitted ? floatingReward : null}
            renderCaptureText={renderCaptureText}
          />
        );
      case "spelling_from_audio":
        return (
          <SpellingFromAudioExercise
            exercise={currentExercise}
            selectedValue={responseValue}
            onSelect={setResponseValue}
            submitted={submitted}
            focused={focused}
          />
        );
      case "pair_match":
        return (
          <PairMatchExercise
            exercise={currentExercise}
            selectedValue={responseValue}
            onSelect={setResponseValue}
            submitted={submitted}
            focused={focused}
            renderCaptureText={renderCaptureText}
          />
        );
      case "sentence_builder":
        return (
          <SentenceBuilderExercise
            exercise={currentExercise}
            selectedValue={responseValue}
            onSelect={setResponseValue}
            submitted={submitted}
            focused={focused}
            renderCaptureText={renderCaptureText}
          />
        );
      case "error_detection":
        return (
          <ErrorDetectionExercise
            exercise={currentExercise}
            selectedValue={responseValue}
            onSelect={setResponseValue}
            submitted={submitted}
            focused={focused}
            renderCaptureText={renderCaptureText}
          />
        );
      case "fill_blank":
        return (
          <FillBlankExercise
            exercise={currentExercise}
            selectedValue={responseValue}
            onSelect={setResponseValue}
            submitted={submitted}
            focused={focused}
            feedbackReward={submitted ? floatingReward : null}
            renderCaptureText={renderCaptureText}
          />
        );
      case "listen_match":
        return (
          <ListenMatchExercise
            exercise={currentExercise}
            selectedValue={responseValue}
            onSelect={setResponseValue}
            submitted={submitted}
            focused={focused}
            feedbackReward={submitted ? floatingReward : null}
          />
        );
      case "context_meaning":
        return (
          <ContextMeaningExercise
            exercise={currentExercise}
            selectedValue={responseValue}
            onSelect={setResponseValue}
            submitted={submitted}
            focused={focused}
            feedbackReward={submitted ? floatingReward : null}
            renderCaptureText={renderCaptureText}
          />
        );
      case "synonym":
        return (
          <SynonymExercise
            exercise={currentExercise}
            selectedValue={responseValue}
            onSelect={setResponseValue}
            submitted={submitted}
            focused={focused}
            feedbackReward={submitted ? floatingReward : null}
            renderCaptureText={renderCaptureText}
          />
        );
      case "collocation":
        return (
          <CollocationExercise
            exercise={currentExercise}
            selectedValue={responseValue}
            onSelect={setResponseValue}
            submitted={submitted}
            focused={focused}
            feedbackReward={submitted ? floatingReward : null}
            renderCaptureText={renderCaptureText}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div
      className={`mx-auto flex w-full flex-col ${
        focused
          ? "min-h-[100svh] max-w-xl gap-3 overflow-hidden bg-[var(--color-surface)] px-4 pb-0 pt-3 sm:px-6 sm:pt-4"
          : "min-h-[70vh] max-w-2xl gap-4 rounded-[28px] bg-[var(--color-surface)] px-4 py-5 sm:px-6 sm:py-6"
      }`}
    >
      <ExerciseProgressHeader
        currentIndex={currentIndex}
        total={exerciseQueue.length}
        submitted={submitted}
        comboCount={comboCount}
        comboMultiplier={floatingReward?.comboCount === comboCount ? floatingReward.comboMultiplier : undefined}
        comboActive={Boolean(
          submitted &&
            floatingReward &&
            comboCount >= 2 &&
            floatingReward.comboCount === comboCount
        )}
      />

      <div className={focused ? "space-y-1.5 pt-1" : "space-y-1"}>
        {questionText ? (
          captureStudentId && captureContextLessonId ? (
            <InlineVocabularyCaptureText
              studentId={captureStudentId}
              lessonId={captureContextLessonId}
              text={questionText}
              sourceType="question"
              sourceText={getExerciseSentenceText(currentExercise) || questionText}
              className={
                focused
                  ? "drill-question"
                  : "text-[1.6rem] font-semibold leading-[1.18] text-slate-950 sm:text-[1.9rem]"
              }
              as="div"
              onCaptured={(item) => {
                setCaptureToast(item.itemText);
                window.setTimeout(() => {
                  setCaptureToast((current) => (current === item.itemText ? null : current));
                }, 1600);
              }}
            />
          ) : (
            <div className={focused ? "drill-question" : "text-[1.6rem] font-semibold leading-[1.18] text-slate-950 sm:text-[1.9rem]"}>
              {questionText}
            </div>
          )
        ) : null}
      </div>

      <div
        key={currentExercise.id}
        className={`flex-1 space-y-3 transition-all duration-200 ease-out ${
          isAdvancing ? "translate-y-1 opacity-0 blur-[1px]" : "translate-y-0 opacity-100 blur-0"
        } ${focused ? "min-h-0 overflow-y-auto overscroll-contain pb-28 pt-0.5 sm:pb-32" : ""}`}
      >
        {renderExercise()}
      </div>

      <ExercisePlayerFooter
        submitted={submitted}
        canSubmit={canSubmit}
        isLast={currentIndex >= exerciseQueue.length - 1}
        isAdvancing={isAdvancing}
        feedback={currentFeedback}
        focused={focused}
        onContinue={handleContinue}
      />

      {captureToast ? (
        <div
          className={`pointer-events-none fixed inset-x-4 z-40 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white shadow-xl sm:left-auto sm:max-w-sm ${
            focused ? "bottom-24 right-4 sm:right-6" : "bottom-4 right-4 sm:right-6"
          }`}
        >
          Added "{captureToast}" to your vocabulary list.
        </div>
      ) : null}

      {floatingReward && (isTypedResponse || isPairMatch || isSentenceBuilder) ? (
        <div
          key={floatingReward.id}
          className={`pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4 ${
            focused ? "top-20 sm:top-24" : "top-6"
          }`}
        >
          <div className="reward-float rounded-full border border-emerald-200 bg-white/96 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-[var(--shadow-button)] backdrop-blur">
            <span>{`+${floatingReward.xp} XP`}</span>
            {floatingReward.comboCount >= 3 ? (
              <span className="ml-2 text-slate-500">{`Combo x${floatingReward.comboCount}`}</span>
            ) : null}
            {floatingReward.leveledUp ? (
              <span className="ml-2 text-[var(--color-secondary)]">Level up</span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
