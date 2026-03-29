"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getExerciseAcceptableAnswers,
  getExerciseAudioStatus,
  getExerciseAudioUrl,
  getExerciseCorrectAnswer,
  getExerciseModality,
  getExerciseQuestionText,
  getExerciseSentenceText,
  getExerciseTargetWord,
  getExerciseTargetWordId,
} from "@/types/vocab-exercises";
import ExercisePlayerFooter from "./ExercisePlayerFooter";
import ExerciseProgressHeader from "./ExerciseProgressHeader";
import AttemptTelemetryDebug from "./AttemptTelemetryDebug";
import type { Exercise, ExerciseResult } from "./types";
import MeaningMatchExercise from "./renderers/MeaningMatchExercise";
import ListenMatchExercise from "./renderers/ListenMatchExercise";
import SpellingFromAudioExercise from "./renderers/SpellingFromAudioExercise";
import FillBlankExercise from "./renderers/FillBlankExercise";
import ContextMeaningExercise from "./renderers/ContextMeaningExercise";
import SynonymExercise from "./renderers/SynonymExercise";
import CollocationExercise from "./renderers/CollocationExercise";

type Props = {
  exercises: Exercise[];
  title?: string;
  onExerciseComplete?: (result: ExerciseResult) => void;
  onComplete?: (results: ExerciseResult[]) => void;
};

export default function ExercisePlayer({
  exercises,
  title = "Exercise Set",
  onExerciseComplete,
  onComplete,
}: Props) {
  const sessionIdRef = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `session-${Date.now()}`
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responseValue, setResponseValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<ExerciseResult[]>([]);
  const [currentFeedback, setCurrentFeedback] = useState<{
    isCorrect: boolean;
    explanation?: string;
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
      <div className="space-y-4 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
        <div className="space-y-1">
          <div className="text-xl font-semibold text-slate-950">{title}</div>
          <div className="text-sm text-slate-500">Vocabulary session</div>
        </div>
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-5 text-slate-600">
          No exercises available yet.
        </div>
      </div>
    );
  }

  function handleCheck() {
    if (!responseValue.trim()) return;

    const timeSpentMs = Math.max(1, Date.now() - startedAtRef.current);
    const correctAnswerId = getExerciseCorrectAnswer(currentExercise);
    const questionText = getExerciseQuestionText(currentExercise);
    const isTypedResponse = currentExercise.type === "spelling_from_audio";
    const selectedOption = isTypedResponse
      ? null
      : currentExercise.options.find((option) => option.id === responseValue) ?? null;
    const correctOption = isTypedResponse
      ? null
      : currentExercise.options.find((option) => option.id === correctAnswerId) ?? null;
    const selectedAnswer = isTypedResponse
      ? responseValue.trim()
      : selectedOption?.label ?? responseValue;
    const normalizedTypedAnswer = responseValue.trim().toLowerCase();
    const normalizedAcceptableAnswers = getExerciseAcceptableAnswers(currentExercise).map((answer) =>
      answer.trim().toLowerCase()
    );
    const isCorrect = isTypedResponse
      ? normalizedAcceptableAnswers.includes(normalizedTypedAnswer)
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
      correct_answer: isTypedResponse ? correctAnswerId : correctOption?.label ?? correctAnswerId,
      is_correct: isCorrect,
      attempt_index: currentIndex + 1,
      word_progress_id: wordProgressId,
      metadata: {
        selected_option_id: isTypedResponse ? null : responseValue,
        correct_option_id: isTypedResponse ? null : correctAnswerId,
        response_kind: isTypedResponse ? "typed" : "option",
        normalized_selected_answer: normalizedTypedAnswer,
        question_text: questionText,
        sentence_text: getExerciseSentenceText(currentExercise) || null,
        prompt: currentExercise.prompt,
        instructions: currentExercise.instructions ?? null,
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
    }, 140);
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
    <div className="space-y-5 rounded-[32px] border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 shadow-sm sm:space-y-6 sm:p-6">
      <ExerciseProgressHeader currentIndex={currentIndex} total={exercises.length} title={title} />

      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            {currentExercise.instructions ? (
              <div className="text-sm leading-6 text-slate-600">{currentExercise.instructions}</div>
            ) : null}
            {getExerciseQuestionText(currentExercise) ? (
              <div className="text-lg font-semibold leading-tight text-slate-950 sm:text-xl">
                {getExerciseQuestionText(currentExercise)}
              </div>
            ) : null}
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            {submitted ? "Checked" : "Answer"}
          </div>
        </div>
      </div>

      <div
        key={currentExercise.id}
        className={`space-y-5 transition-all duration-200 ease-out ${
          isAdvancing ? "translate-y-1 opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        {renderExercise()}
      </div>

      <ExercisePlayerFooter
        submitted={submitted}
        canSubmit={Boolean(responseValue.trim())}
        isLast={currentIndex >= exercises.length - 1}
        feedback={currentFeedback}
        onCheck={handleCheck}
        onContinue={handleContinue}
      />

      <AttemptTelemetryDebug
        title="Debug Attempts"
        summary={[
          { label: "Session ID", value: sessionIdRef.current },
          { label: "Collected", value: results.length },
          { label: "Current Index", value: `${Math.min(currentIndex + 1, exercises.length)}/${exercises.length}` },
          { label: "Checked", value: submitted ? "yes" : "no" },
        ]}
        payload={results}
      />
    </div>
  );
}
