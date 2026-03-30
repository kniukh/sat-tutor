"use client";

import { useMemo, useState } from "react";
import ExercisePromptPanel from "../ExercisePromptPanel";
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

export default function PairMatchExercise({
  exercise,
  selectedValue,
  onSelect,
  submitted,
  renderCaptureText,
}: ExerciseRendererProps<PairMatchExerciseData>) {
  const [activeLeftId, setActiveLeftId] = useState<string | null>(null);
  const [activeRightId, setActiveRightId] = useState<string | null>(null);

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

  const visibleLeftOptions = leftOptions.filter((option) => !matchedLeftIds.has(option.id));
  const visibleRightOptions = rightOptions.filter((option) => !matchedRightIds.has(option.id));

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

  function handleSelectLeft(leftId: string) {
    if (submitted) {
      return;
    }

    if (activeRightId) {
      commitPair(leftId, activeRightId);
      return;
    }

    setActiveLeftId((current) => (current === leftId ? null : leftId));
  }

  function handleSelectRight(rightId: string) {
    if (submitted) {
      return;
    }

    if (activeLeftId) {
      commitPair(activeLeftId, rightId);
      return;
    }

    setActiveRightId((current) => (current === rightId ? null : rightId));
  }

  function handleRemovePair(pairKey: string) {
    if (submitted) {
      return;
    }

    setActiveLeftId(null);
    setActiveRightId(null);
    onSelect(serializeSelectedPairKeys(selectedPairKeys.filter((key) => key !== pairKey)));
  }

  function handleReset() {
    if (submitted || selectedPairKeys.length === 0) {
      return;
    }

    setActiveLeftId(null);
    setActiveRightId(null);
    onSelect("");
  }

  return (
    <div className="space-y-5">
      <ExercisePromptPanel
        body={
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                Pair match
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800">
                {selectedPairs.length}/{getExercisePairs(exercise).length} matched
              </span>
            </div>

            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Matched pairs
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={submitted || selectedPairKeys.length === 0}
                  className="text-xs font-semibold text-slate-500 transition-colors hover:text-slate-800 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  Reset
                </button>
              </div>

              <div className="mt-3 flex min-h-16 flex-wrap gap-2 rounded-[18px] border border-dashed border-slate-300 bg-white p-3">
                {selectedPairs.length > 0 ? (
                  selectedPairs.map((pair) => {
                    const leftLabel =
                      leftOptions.find((option) => option.id === pair.leftId)?.label ?? pair.leftId;
                    const rightLabel =
                      rightOptions.find((option) => option.id === pair.rightId)?.label ??
                      pair.rightId;

                    return (
                      <button
                        key={pair.key}
                        type="button"
                        onClick={() => handleRemovePair(pair.key)}
                        disabled={submitted}
                        className="rounded-2xl border border-slate-300 bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
                        aria-label={`Remove match ${leftLabel} to ${rightLabel}`}
                      >
                        {renderCaptureText
                          ? renderCaptureText({
                              text: `${leftLabel} ${rightLabel}`,
                              contextText: `${leftLabel} ${rightLabel}`,
                            })
                          : (
                              <>
                                {leftLabel} {"->"} {rightLabel}
                              </>
                            )}
                      </button>
                    );
                  })
                ) : (
                  <div className="text-sm leading-6 text-slate-400">
                    Tap one item on each side to lock in a pair.
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {exercise.left_column_label ?? exercise.leftColumnLabel ?? "Left side"}
                </div>
                <div className="flex flex-col gap-2">
                  {visibleLeftOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleSelectLeft(option.id)}
                      disabled={submitted}
                      className={`rounded-[18px] border px-4 py-3 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${
                        activeLeftId === option.id
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {renderCaptureText
                        ? renderCaptureText({
                            text: option.label,
                            contextText: option.label,
                          })
                        : option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {exercise.right_column_label ?? exercise.rightColumnLabel ?? "Right side"}
                </div>
                <div className="flex flex-col gap-2">
                  {visibleRightOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleSelectRight(option.id)}
                      disabled={submitted}
                      className={`rounded-[18px] border px-4 py-3 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${
                        activeRightId === option.id
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {renderCaptureText
                        ? renderCaptureText({
                            text: option.label,
                            contextText: option.label,
                          })
                        : option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        }
        footer="Match everything before checking your answer."
      />
    </div>
  );
}
