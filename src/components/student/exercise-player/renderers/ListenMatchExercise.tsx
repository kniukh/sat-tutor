"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ExerciseOptionList from "../ExerciseOptionList";
import AudioExercisePrompt from "../AudioExercisePrompt";
import {
  getExerciseCorrectAnswer,
  getExercisePairLeftId,
  getExercisePairRightId,
  getExercisePairs,
  type VocabExerciseOption,
} from "@/types/vocab-exercises";
import type { ExerciseRendererProps, ListenMatchExerciseData } from "../types";

function parseSelectedPairKeys(value: string) {
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

function serializeSelectedPairKeys(pairKeys: string[]) {
  return pairKeys.length > 0 ? JSON.stringify(pairKeys) : "";
}

function buildFallbackOptions(
  exercise: ListenMatchExerciseData
): { leftOptions: VocabExerciseOption[]; rightOptions: VocabExerciseOption[] } {
  const pairs = getExercisePairs(exercise);

  return {
    leftOptions: pairs.map((pair, index) => ({
      id: getExercisePairLeftId(pair),
      label: pair.left || `Audio ${index + 1}`,
    })),
    rightOptions: pairs.map((pair) => ({
      id: getExercisePairRightId(pair),
      label: pair.right,
    })),
  };
}

type PairFeedbackState = {
  leftId: string;
  rightId: string;
  status: "correct" | "wrong";
};

function ListenWaveIcon({ active = false }: { active?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-[#23b8e6]">
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0">
        <path
          d="M11 5.5 7.75 8H5.5A1.5 1.5 0 0 0 4 9.5v5A1.5 1.5 0 0 0 5.5 16h2.25L11 18.5a.75.75 0 0 0 1.2-.6V6.1a.75.75 0 0 0-1.2-.6Z"
          fill="currentColor"
        />
        <path
          d="M15.5 8.75a4.5 4.5 0 0 1 0 6.5M17.75 6.5a7.5 7.5 0 0 1 0 11"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      </svg>
      <div className="flex h-8 items-center gap-0.5" aria-hidden="true">
        {[10, 18, 12, 26, 20, 30, 16, 24, 14, 22, 10].map((height, index) => (
          <span
            key={`${height}-${index}`}
            className={`w-1 rounded-full bg-current transition-all duration-200 ${
              active && index % 2 === 0 ? "scale-y-110" : ""
            }`}
            style={{ height: `${height}px` }}
          />
        ))}
      </div>
    </div>
  );
}

export default function ListenMatchExercise({
  exercise,
  selectedValue,
  onSelect,
  submitted,
  feedbackReward,
  renderCaptureText,
}: ExerciseRendererProps<ListenMatchExerciseData>) {
  const pairs = getExercisePairs(exercise);
  const isPairMode = pairs.length > 1;
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const [activeLeftId, setActiveLeftId] = useState<string | null>(null);
  const [activeRightId, setActiveRightId] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [pairFeedback, setPairFeedback] = useState<PairFeedbackState | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);

  const selectedPairKeys = parseSelectedPairKeys(selectedValue);
  const selectedPairs = selectedPairKeys.map((pairKey) => {
    const [leftId, rightId] = pairKey.split("::");
    return { key: pairKey, leftId, rightId };
  });
  const matchedLeftIds = new Set(selectedPairs.map((pair) => pair.leftId));
  const matchedRightIds = new Set(selectedPairs.map((pair) => pair.rightId));

  const fallbackOptions = useMemo(() => buildFallbackOptions(exercise), [exercise]);
  const leftOptions = useMemo(
    () =>
      exercise.options.filter((option) => option.id.startsWith("left-")).length > 0
        ? exercise.options.filter((option) => option.id.startsWith("left-"))
        : fallbackOptions.leftOptions,
    [exercise.options, fallbackOptions.leftOptions]
  );
  const rightOptions = useMemo(
    () =>
      exercise.options.filter((option) => option.id.startsWith("right-")).length > 0
        ? exercise.options.filter((option) => option.id.startsWith("right-"))
        : fallbackOptions.rightOptions,
    [exercise.options, fallbackOptions.rightOptions]
  );
  const expectedRightByLeftId = useMemo(
    () =>
      new Map(
        pairs.map((pair) => [getExercisePairLeftId(pair), getExercisePairRightId(pair)])
      ),
    [pairs]
  );

  useEffect(() => {
    setActiveLeftId(null);
    setActiveRightId(null);
    setPlayingAudioId(null);
    setPairFeedback(null);

    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = null;
    }
  }, [exercise.id]);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  async function playPairAudio(leftId: string) {
    const pair = pairs.find((entry) => getExercisePairLeftId(entry) === leftId);
    const audioUrl = pair?.leftAudioUrl ?? pair?.left_audio_url ?? null;
    if (!audioUrl) {
      return;
    }

    const currentAudio = audioRefs.current[leftId];
    if (!currentAudio) {
      return;
    }

    try {
      setPlayingAudioId(leftId);
      currentAudio.currentTime = 0;
      await currentAudio.play();
    } catch (error) {
      console.error("listen match pair audio error", error);
      setPlayingAudioId(null);
    }
  }

  function commitPair(leftId: string, rightId: string) {
    const nextPairKeys = [
      ...selectedPairKeys.filter((pairKey) => {
        const [existingLeftId, existingRightId] = pairKey.split("::");
        return existingLeftId !== leftId && existingRightId !== rightId;
      }),
      `${leftId}::${rightId}`,
    ];

    setActiveLeftId(null);
    setActiveRightId(null);
    onSelect(serializeSelectedPairKeys(nextPairKeys));
  }

  function handlePairAttempt(leftId: string, rightId: string) {
    const isCorrect = expectedRightByLeftId.get(leftId) === rightId;

    setPairFeedback({
      leftId,
      rightId,
      status: isCorrect ? "correct" : "wrong",
    });

    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }

    feedbackTimeoutRef.current = window.setTimeout(() => {
      if (isCorrect) {
        commitPair(leftId, rightId);
      } else {
        setActiveLeftId(null);
        setActiveRightId(null);
      }

      setPairFeedback(null);
      feedbackTimeoutRef.current = null;
    }, 280);
  }

  function handleSelectLeft(leftId: string) {
    if (submitted || pairFeedback || matchedLeftIds.has(leftId)) {
      return;
    }

    void playPairAudio(leftId);

    if (activeRightId) {
      if (matchedRightIds.has(activeRightId)) {
        setActiveRightId(null);
        setActiveLeftId(leftId);
        return;
      }

      handlePairAttempt(leftId, activeRightId);
      return;
    }

    setActiveLeftId((current) => (current === leftId ? null : leftId));
  }

  function handleSelectRight(rightId: string) {
    if (submitted || pairFeedback || matchedRightIds.has(rightId)) {
      return;
    }

    if (activeLeftId) {
      if (matchedLeftIds.has(activeLeftId)) {
        setActiveLeftId(null);
        setActiveRightId(rightId);
        return;
      }

      handlePairAttempt(activeLeftId, rightId);
      return;
    }

    setActiveRightId((current) => (current === rightId ? null : rightId));
  }

  function getListenPairClassName(optionId: string, side: "left" | "right", isMatched: boolean) {
    const isActive = side === "left" ? activeLeftId === optionId : activeRightId === optionId;
    const isFeedbackTarget =
      pairFeedback &&
      (side === "left"
        ? pairFeedback.leftId === optionId
        : pairFeedback.rightId === optionId);

    if (isFeedbackTarget && pairFeedback?.status === "correct") {
      return "border-emerald-300 bg-emerald-100 text-emerald-700 ring-2 ring-emerald-200";
    }

    if (isFeedbackTarget && pairFeedback?.status === "wrong") {
      return "animate-pulse border-rose-300 bg-rose-100 text-rose-700 ring-2 ring-rose-200";
    }

    if (isMatched) {
      return "border-slate-200 bg-white text-slate-400";
    }

    if (isActive) {
      return "border-[#9edbf0] bg-[#dff6fd] text-slate-900 ring-2 ring-[#bce8f7]";
    }

    return "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50";
  }

  if (!isPairMode) {
    return (
      <div className="grid gap-3 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:items-start">
        <div className="drill-context-surface p-4">
          <div className="token-text-muted mb-2 text-xs font-semibold uppercase tracking-[0.16em]">
            Audio
          </div>
          <AudioExercisePrompt
            exercise={exercise}
            fallbackContent={<>Audio is unavailable for this listening exercise right now.</>}
          />
        </div>

        <div className="space-y-3">
          <div className="token-text-muted text-xs font-semibold uppercase tracking-[0.16em]">
            {exercise.variant === "translation"
              ? exercise.rightColumnLabel ?? exercise.right_column_label ?? "Translations"
              : exercise.rightColumnLabel ?? exercise.right_column_label ?? "Meanings"}
          </div>
          <ExerciseOptionList
            options={exercise.options}
            selectedOptionId={selectedValue || null}
            correctOptionId={getExerciseCorrectAnswer(exercise)}
            submitted={submitted}
            feedbackReward={feedbackReward}
            onSelect={onSelect}
            renderOptionLabel={({ option, isDistractor }) =>
              renderCaptureText
                ? renderCaptureText({
                    text: option.label,
                    contextText: exercise.questionText ?? exercise.prompt ?? option.label,
                    isDistractor,
                  })
                : option.label
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="grid grid-cols-[minmax(6.75rem,8rem)_minmax(0,1fr)] gap-3 sm:grid-cols-[minmax(7.5rem,9rem)_minmax(0,1fr)]"
        aria-label="Matching options"
      >
        <div className="space-y-3" role="list" aria-label="Audio column">
          {leftOptions.map((option) => {
            const pair = pairs.find((entry) => getExercisePairLeftId(entry) === option.id);
            const audioUrl = pair?.leftAudioUrl ?? pair?.left_audio_url ?? null;
            const isMatched = matchedLeftIds.has(option.id);
            const isPlaying = playingAudioId === option.id;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleSelectLeft(option.id)}
                disabled={submitted || isMatched}
                className={`flex min-h-16 w-full items-center justify-center rounded-2xl border px-3 py-3 shadow-[0_2px_0_rgba(15,23,42,0.08)] transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7dd3fc] focus-visible:ring-offset-2 disabled:cursor-default ${getListenPairClassName(
                  option.id,
                  "left",
                  isMatched
                )}`}
                aria-pressed={activeLeftId === option.id || isMatched}
              >
                <ListenWaveIcon active={isPlaying} />
                <span className="sr-only">
                  {audioUrl ? `Play audio ${option.label}` : "Audio unavailable"}
                </span>
                {audioUrl ? (
                  <audio
                    ref={(node) => {
                      audioRefs.current[option.id] = node;
                    }}
                    src={audioUrl}
                    preload="none"
                    onEnded={() => setPlayingAudioId((current) => (current === option.id ? null : current))}
                    onPause={() => setPlayingAudioId((current) => (current === option.id ? null : current))}
                    hidden
                  />
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="space-y-3" role="list" aria-label="Meaning column">
          {rightOptions.map((option) => {
            const isMatched = matchedRightIds.has(option.id);

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleSelectRight(option.id)}
                disabled={submitted || isMatched}
                className={`min-h-16 rounded-2xl border px-4 py-3 text-center text-sm font-medium shadow-[0_2px_0_rgba(15,23,42,0.08)] transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7dd3fc] focus-visible:ring-offset-2 disabled:cursor-default ${getListenPairClassName(
                  option.id,
                  "right",
                  isMatched
                )}`}
                aria-pressed={activeRightId === option.id || isMatched}
              >
                {renderCaptureText
                  ? renderCaptureText({
                      text: option.label,
                      contextText: exercise.questionText ?? exercise.prompt ?? option.label,
                      className: isMatched ? "text-slate-400" : undefined,
                    })
                  : option.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
