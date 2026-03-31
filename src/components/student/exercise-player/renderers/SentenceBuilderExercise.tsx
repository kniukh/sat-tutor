"use client";

import {
  getExerciseSentenceText,
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
  renderCaptureText,
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
    <div className="space-y-3">
      <div className="drill-context-surface p-3.5">
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleReset}
            disabled={submitted || selectedTileIds.length === 0}
            className="text-xs font-semibold text-slate-500 transition-colors hover:text-slate-800 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            Reset
          </button>
        </div>

        <div className="mt-2 flex min-h-18 flex-wrap gap-2 rounded-[18px] border border-dashed border-slate-300 bg-white p-3">
          {selectedOptions.length > 0 ? (
            selectedOptions.map((option, index) => (
              <button
                key={`${option.id}:${index}`}
                type="button"
                onClick={() => handleRemoveTile(option.id, index)}
                disabled={submitted}
                className="rounded-2xl border border-slate-300 bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
                aria-label={`Remove ${option.label}`}
              >
                {renderCaptureText
                  ? renderCaptureText({
                      text: option.label,
                      contextText: getExerciseSentenceText(exercise),
                    })
                  : option.label}
              </button>
            ))
          ) : (
            <div className="text-sm leading-6 text-slate-400">
              Tap the tiles below to build the sentence.
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="list" aria-label="Sentence tiles">
        {remainingOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => handleAddTile(option.id)}
            disabled={submitted}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            {renderCaptureText
              ? renderCaptureText({
                  text: option.label,
                  contextText: getExerciseSentenceText(exercise),
                })
              : option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
