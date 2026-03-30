"use client";

import ExercisePromptPanel from "../ExercisePromptPanel";
import {
  getExerciseSentenceSegments,
  getExerciseTargetWord,
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
  const replacementText = exercise.replacement_text ?? exercise.replacementText ?? null;

  return (
    <div className="space-y-5">
      <ExercisePromptPanel
        body={
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                SAT-style language
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800">
                Focus:{" "}
                {renderCaptureText
                  ? renderCaptureText({
                      text: getExerciseTargetWord(exercise),
                      contextText: sentenceSegments.map((segment) => segment.text).join(" "),
                    })
                  : getExerciseTargetWord(exercise)}
              </span>
            </div>

            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Sentence
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {sentenceSegments.map((segment) => {
                  const isSelected = selectedValue === segment.id;

                  return (
                    <button
                      key={segment.id}
                      type="button"
                      disabled={submitted}
                      onClick={() => onSelect(segment.id)}
                      className={`rounded-2xl border px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
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
                className={`rounded-[20px] border px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
                  selectedValue === "no_error"
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                } disabled:cursor-not-allowed disabled:opacity-100`}
              >
                No error
              </button>
            ) : null}

            {replacementText ? (
              <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
                If you find the error, the strongest replacement is{" "}
                <span className="font-semibold text-slate-900">
                  {renderCaptureText
                    ? renderCaptureText({
                        text: replacementText,
                        contextText: sentenceSegments.map((segment) => segment.text).join(" "),
                      })
                    : replacementText}
                </span>.
              </div>
            ) : null}
          </div>
        }
        footer="Tap the word or phrase that makes the sentence least precise or effective."
      />
    </div>
  );
}
