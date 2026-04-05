"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getExercisePairLeftId,
  getExercisePairRightId,
  getExercisePairs,
  type VocabExerciseOption,
} from "@/types/vocab-exercises";
import type { ExerciseRendererProps, PairMatchExerciseData } from "../types";

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
  exercise: PairMatchExerciseData
): { leftOptions: VocabExerciseOption[]; rightOptions: VocabExerciseOption[] } {
  const pairs = getExercisePairs(exercise);

  return {
    leftOptions: pairs.map((pair) => ({
      id: getExercisePairLeftId(pair),
      label: pair.left,
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

export default function PairMatchExercise({
  exercise,
  selectedValue,
  onSelect,
  submitted,
  renderCaptureText,
}: ExerciseRendererProps<PairMatchExerciseData>) {
  const [activeLeftId, setActiveLeftId] = useState<string | null>(null);
  const [activeRightId, setActiveRightId] = useState<string | null>(null);
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
  const expectedRightByLeftId = useMemo(() => {
    return new Map(
      getExercisePairs(exercise).map((pair) => [
        getExercisePairLeftId(pair),
        getExercisePairRightId(pair),
      ])
    );
  }, [exercise]);

  useEffect(() => {
    setActiveLeftId(null);
    setActiveRightId(null);
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

  function getOptionClassName(
    optionId: string,
    side: "left" | "right",
    isMatched: boolean
  ) {
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
      return "border-slate-950 bg-slate-950 text-white";
    }

    return "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50";
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2" aria-label="Matching options">
        <div className="flex flex-col gap-2" role="list" aria-label="Left column">
          {leftOptions.map((option) => {
            const isMatched = matchedLeftIds.has(option.id);

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleSelectLeft(option.id)}
                disabled={submitted || isMatched}
                className={`rounded-[18px] border px-4 py-3 text-left text-sm font-semibold transition-all duration-200 active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-default ${getOptionClassName(
                  option.id,
                  "left",
                  isMatched
                )}`}
                aria-pressed={activeLeftId === option.id || isMatched}
              >
                {renderCaptureText
                  ? renderCaptureText({
                      text: option.label,
                      contextText: option.label,
                      className: isMatched ? "text-slate-400" : undefined,
                    })
                  : option.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2" role="list" aria-label="Right column">
          {rightOptions.map((option) => {
            const isMatched = matchedRightIds.has(option.id);

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleSelectRight(option.id)}
                disabled={submitted || isMatched}
                className={`rounded-[18px] border px-4 py-3 text-left text-sm font-semibold transition-all duration-200 active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-default ${getOptionClassName(
                  option.id,
                  "right",
                  isMatched
                )}`}
                aria-pressed={activeRightId === option.id || isMatched}
              >
                {renderCaptureText
                  ? renderCaptureText({
                      text: option.label,
                      contextText: option.label,
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
