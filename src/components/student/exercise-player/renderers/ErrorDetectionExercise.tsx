"use client";

import {
  getExerciseSentenceSegments,
} from "@/types/vocab-exercises";
import type { ErrorDetectionExerciseData, ExerciseRendererProps } from "../types";

export default function ErrorDetectionExercise({
  exercise,
  selectedValue,
  onSelect,
  submitted,
  renderCaptureText,
}: ExerciseRendererProps<ErrorDetectionExerciseData>) {
  const sentenceSegments = getExerciseSentenceSegments(exercise);
  const allowNoError = exercise.allow_no_error ?? exercise.allowNoError ?? false;

  return (
    <div className="space-y-3">
      <div className="drill-context-surface p-3.5">
        <div className="flex flex-wrap gap-2">
          {sentenceSegments.map((segment) => {
            const isSelected = selectedValue === segment.id;

            return (
              <button
                key={segment.id}
                type="button"
                disabled={submitted}
                onClick={() => onSelect(segment.id)}
                className={`rounded-2xl border px-3 py-2 text-left text-sm font-medium transition-all active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
                  isSelected
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50"
                } disabled:cursor-not-allowed disabled:opacity-100`}
              >
                {renderCaptureText
                  ? renderCaptureText({
                      text: segment.text,
                      contextText: sentenceSegments.map((item) => item.text).join(" "),
                      isDistractor: false,
                    })
                  : segment.text}
              </button>
            );
          })}
        </div>
      </div>

      {allowNoError ? (
        <button
          type="button"
          disabled={submitted}
          onClick={() => onSelect("no_error")}
          className={`rounded-[20px] border px-4 py-3 text-sm font-semibold transition-all active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
            selectedValue === "no_error"
              ? "border-slate-950 bg-slate-950 text-white"
              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
          } disabled:cursor-not-allowed disabled:opacity-100`}
        >
          No error
        </button>
      ) : null}
    </div>
  );
}
