"use client";

import ExercisePromptPanel from "../ExercisePromptPanel";
import {
  getExerciseSentenceText,
  getExerciseTargetWord,
} from "@/types/vocab-exercises";
import type { ExerciseRendererProps, SentenceBuilderExerciseData } from "../types";

function parseSelectedTileIds(value: string) {
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

function serializeSelectedTileIds(tileIds: string[]) {
  return tileIds.length > 0 ? JSON.stringify(tileIds) : "";
}

export default function SentenceBuilderExercise({
  exercise,
  selectedValue,
  onSelect,
  submitted,
}: ExerciseRendererProps<SentenceBuilderExerciseData>) {
  const selectedTileIds = parseSelectedTileIds(selectedValue);
  const selectedOptions = selectedTileIds
    .map((tileId) => exercise.options.find((option) => option.id === tileId))
    .filter((option): option is SentenceBuilderExerciseData["options"][number] => Boolean(option));
  const remainingOptions = exercise.options.filter(
    (option) => !selectedTileIds.includes(option.id)
  );

  function handleAddTile(tileId: string) {
    if (submitted) {
      return;
    }

    onSelect(serializeSelectedTileIds([...selectedTileIds, tileId]));
  }

  function handleRemoveTile(tileId: string, index: number) {
    if (submitted) {
      return;
    }

    const nextTileIds = [...selectedTileIds];
    if (nextTileIds[index] === tileId) {
      nextTileIds.splice(index, 1);
    } else {
      const fallbackIndex = nextTileIds.indexOf(tileId);
      if (fallbackIndex >= 0) {
        nextTileIds.splice(fallbackIndex, 1);
      }
    }

    onSelect(serializeSelectedTileIds(nextTileIds));
  }

  function handleReset() {
    if (submitted || selectedTileIds.length === 0) {
      return;
    }

    onSelect("");
  }

  return (
    <div className="space-y-5">
      <ExercisePromptPanel
        body={
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                Build the sentence
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800">
                Target: {getExerciseTargetWord(exercise)}
              </span>
            </div>

            {exercise.clue ? (
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                {exercise.clue}
              </div>
            ) : null}

            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Your sentence
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={submitted || selectedTileIds.length === 0}
                  className="text-xs font-semibold text-slate-500 transition-colors hover:text-slate-800 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  Reset
                </button>
              </div>

              <div className="mt-3 flex min-h-20 flex-wrap gap-2 rounded-[18px] border border-dashed border-slate-300 bg-white p-3">
                {selectedOptions.length > 0 ? (
                  selectedOptions.map((option, index) => (
                    <button
                      key={`${option.id}:${index}`}
                      type="button"
                      onClick={() => handleRemoveTile(option.id, index)}
                      disabled={submitted}
                      className="rounded-2xl border border-slate-300 bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
                      aria-label={`Remove ${option.label}`}
                    >
                      {option.label}
                    </button>
                  ))
                ) : (
                  <div className="text-sm leading-6 text-slate-400">
                    Tap the tiles below to build the sentence.
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Tile bank
              </div>
              <div className="flex flex-wrap gap-2" role="list" aria-label="Sentence tiles">
                {remainingOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleAddTile(option.id)}
                    disabled={submitted}
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        }
        footer={
          getExerciseSentenceText(exercise)
            ? "Rebuild the sentence in the most natural order."
            : "Use the tiles to rebuild the sentence in the correct order."
        }
      />
    </div>
  );
}
