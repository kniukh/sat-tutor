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

type Props = {
  exercises: Exercise[];
  title?: string;
  sessionId?: string;
  sessionMetadata?: Record<string, unknown>;
  modeLabel?: string;
  headerHelperText?: string;
  onExerciseComplete?: (result: ExerciseResult) => void;
  onComplete?: (results: ExerciseResult[]) => void;
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

export default function ExercisePlayer({
  exercises,
  sessionId,
  sessionMetadata,
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
  const [responseValue, setResponseValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<ExerciseResult[]>([]);
  const [currentFeedback, setCurrentFeedback] = useState<{
    isCorrect: boolean;
    explanation?: string;
    selectedAnswer?: string;
    correctAnswer?: string;
    answerLabel?: string;
  } | null>(null);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const startedAtRef = useRef<number>(Date.now());

  const currentExercise = exercises[currentIndex] ?? null;

  useEffect(() => {
    startedAtRef.current = Date.now();
    setIsAdvancing(false);
  }, [currentIndex]);

  const currentResult = useMemo(
    () => results.find((item) => item.exercise_id === currentExercise?.id) ?? null,
    [results, currentExercise]
  );

  if (!currentExercise) {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-slate-600 shadow-sm sm:p-7">
          No exercises available yet.
      </div>
    );
  }

  const isTypedResponse = currentExercise.type === "spelling_from_audio";
  const isPairMatch = currentExercise.type === "pair_match";
  const isSentenceBuilder = currentExercise.type === "sentence_builder";
  const selectedPairKeys = isPairMatch ? parsePairMatchResponse(responseValue) : [];
  const selectedTileIds = isSentenceBuilder
    ? parseSentenceBuilderResponse(responseValue)
    : [];
  const pairCount = isPairMatch ? getExercisePairs(currentExercise).length : 0;
  const canSubmit = isPairMatch
    ? pairCount > 0 && selectedPairKeys.length === pairCount
    : isSentenceBuilder
      ? selectedTileIds.length > 0
      : Boolean(responseValue.trim());

  function handleCheck() {
    if (!canSubmit) return;

    const timeSpentMs = Math.max(1, Date.now() - startedAtRef.current);
    const correctAnswerId = getExerciseCorrectAnswer(currentExercise);
    const questionText = getExerciseQuestionText(currentExercise);
    const selectedOption = isTypedResponse
      ? null
      : isPairMatch
        ? null
      : isSentenceBuilder
        ? null
      : currentExercise.options.find((option) => option.id === responseValue) ?? null;
    const correctOption = isTypedResponse
      ? null
      : isPairMatch
        ? null
      : isSentenceBuilder
        ? null
      : currentExercise.options.find((option) => option.id === correctAnswerId) ?? null;
    const correctPairs = isPairMatch
      ? getExercisePairs(currentExercise).map((pair) => ({
          key: `${getExercisePairLeftId(pair)}::${getExercisePairRightId(pair)}`,
          label: `${pair.left} -> ${pair.right}`,
        }))
      : [];
    const selectedPairLabels = isPairMatch
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
      : isPairMatch
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
      : isPairMatch
        ? JSON.stringify(sortPairMatchKeys(selectedPairKeys)) ===
          JSON.stringify(sortPairMatchKeys(correctPairs.map((pair) => pair.key)))
      : isSentenceBuilder
        ? JSON.stringify(selectedTileIds) ===
          JSON.stringify(getExerciseCorrectSequence(currentExercise))
      : getExerciseAcceptableAnswers(currentExercise).includes(responseValue);
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
          : isPairMatch
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
          isTypedResponse || isSentenceBuilder || isPairMatch ? null : responseValue,
        correct_option_id:
          isTypedResponse || isSentenceBuilder || isPairMatch ? null : correctAnswerId,
        response_kind: isTypedResponse
          ? "typed"
          : isPairMatch
            ? "pair_match"
            : isSentenceBuilder
            ? "tile_builder"
            : "option",
        normalized_selected_answer: isSentenceBuilder
          ? (builtSentence ?? "").trim().toLowerCase()
          : normalizedTypedAnswer,
        selected_pairs: isPairMatch ? selectedPairKeys : null,
        correct_pairs: isPairMatch ? correctPairs.map((pair) => pair.key) : null,
        selected_pair_labels: isPairMatch ? selectedPairLabels : null,
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
    setCurrentFeedback({
      isCorrect,
      explanation: currentExercise.explanation,
      selectedAnswer: selectedAnswer,
      correctAnswer: isTypedResponse
        ? correctAnswerId
        : isPairMatch
          ? correctPairs.map((pair) => pair.label).join(" | ")
        : isSentenceBuilder
          ? correctAnswerId
          : correctOption?.label ?? correctAnswerId,
      answerLabel: isTypedResponse
        ? "Your spelling"
        : isPairMatch
          ? "Your matches"
        : isSentenceBuilder
          ? "Your sentence"
          : "Your answer",
    });
    setResults((prev) => [
      ...prev.filter((item) => item.exercise_id !== result.exercise_id),
      result,
    ]);
    console.debug("Vocab exercise attempt", result);
    onExerciseComplete?.(result);
  }

  function handleContinue() {
    if (currentIndex >= exercises.length - 1) {
      onComplete?.(
        [...results.filter((item) => item.exercise_id !== currentExercise.id), currentResult].filter(
          (item): item is ExerciseResult => Boolean(item)
        )
      );
      return;
    }

    setIsAdvancing(true);
    window.setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
      setResponseValue("");
      setSubmitted(false);
      setCurrentFeedback(null);
    }, 180);
  }

  function renderExercise() {
    switch (currentExercise.type) {
      case "meaning_match":
      case "translation_match":
        return (
          <MeaningMatchExercise
            exercise={currentExercise}
            selectedValue={responseValue}
            onSelect={setResponseValue}
            submitted={submitted}
          />
        );
      case "spelling_from_audio":
        return (
          <SpellingFromAudioExercise
            exercise={currentExercise}
            selectedValue={responseValue}
            onSelect={setResponseValue}
            submitted={submitted}
          />
        );
      case "pair_match":
        return (
          <PairMatchExercise
            exercise={currentExercise}
            selectedValue={responseValue}
            onSelect={setResponseValue}
            submitted={submitted}
          />
        );
      case "sentence_builder":
        return (
          <SentenceBuilderExercise
            exercise={currentExercise}
            selectedValue={responseValue}
            onSelect={setResponseValue}
            submitted={submitted}
          />
        );
      case "error_detection":
        return (
          <ErrorDetectionExercise
            exercise={currentExercise}
            selectedValue={responseValue}
            onSelect={setResponseValue}
            submitted={submitted}
          />
        );
      case "fill_blank":
        return (
          <FillBlankExercise
            exercise={currentExercise}
            selectedValue={responseValue}
            onSelect={setResponseValue}
            submitted={submitted}
          />
        );
      case "listen_match":
        return (
          <ListenMatchExercise
            exercise={currentExercise}
            selectedValue={responseValue}
            onSelect={setResponseValue}
            submitted={submitted}
          />
        );
      case "context_meaning":
        return (
          <ContextMeaningExercise
            exercise={currentExercise}
            selectedValue={responseValue}
            onSelect={setResponseValue}
            submitted={submitted}
          />
        );
      case "synonym":
        return (
          <SynonymExercise
            exercise={currentExercise}
            selectedValue={responseValue}
            onSelect={setResponseValue}
            submitted={submitted}
          />
        );
      case "collocation":
        return (
          <CollocationExercise
            exercise={currentExercise}
            selectedValue={responseValue}
            onSelect={setResponseValue}
            submitted={submitted}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col gap-6 rounded-[28px] bg-white px-4 py-5 sm:px-6 sm:py-6">
      <ExerciseProgressHeader
        currentIndex={currentIndex}
        total={exercises.length}
      />

      <div className="space-y-2">
        {getExerciseQuestionText(currentExercise) ? (
          <div className="text-2xl font-semibold leading-tight text-slate-950 sm:text-3xl">
            {getExerciseQuestionText(currentExercise)}
          </div>
        ) : null}
      </div>

      <div
        key={currentExercise.id}
        className={`flex-1 space-y-5 transition-all duration-200 ease-out ${
          isAdvancing ? "translate-y-1 opacity-0 blur-[1px]" : "translate-y-0 opacity-100 blur-0"
        }`}
      >
        {renderExercise()}
      </div>

      <ExercisePlayerFooter
        submitted={submitted}
        canSubmit={canSubmit}
        isLast={currentIndex >= exercises.length - 1}
        feedback={currentFeedback}
        onCheck={handleCheck}
        onContinue={handleContinue}
      />
    </div>
  );
}
