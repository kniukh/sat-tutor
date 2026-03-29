import ExerciseOptionList from "../ExerciseOptionList";
import ExercisePromptPanel from "../ExercisePromptPanel";
import {
  getExerciseCorrectAnswer,
  getExerciseSentenceText,
  getExerciseTargetWord,
} from "@/types/vocab-exercises";
import type { ExerciseRendererProps, SynonymExerciseData } from "../types";

function getPromptHint(promptStyle: SynonymExerciseData["promptStyle"]) {
  if (promptStyle === "best_synonym") {
    return "Look for the closest substitute word, not just a loosely related idea.";
  }

  return "Choose the option with the nearest meaning and the best semantic match.";
}

export default function SynonymExercise({
  exercise,
  selectedOptionId,
  onSelect,
  submitted,
}: ExerciseRendererProps<SynonymExerciseData>) {
  return (
    <div className="space-y-5">
      <ExercisePromptPanel
        eyebrow={exercise.prompt}
        body={
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Find the closest match
              </span>
              <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-800">
                Target: {getExerciseTargetWord(exercise)}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-[0.72fr_1fr]">
              <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5 text-white shadow-[0_18px_35px_-24px_rgba(15,23,42,0.8)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  Target Word
                </div>
                <div className="mt-3 text-2xl font-semibold tracking-tight">
                  {getExerciseTargetWord(exercise)}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                {getPromptHint(exercise.promptStyle)}
              </div>
            </div>

            {getExerciseSentenceText(exercise) ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  In Use
                </div>
                <div className="mt-2 text-base leading-7 text-slate-800">
                  {getExerciseSentenceText(exercise)}
                </div>
              </div>
            ) : null}
          </div>
        }
      />

      <ExerciseOptionList
        options={exercise.options}
        selectedOptionId={selectedOptionId}
        correctOptionId={getExerciseCorrectAnswer(exercise)}
        submitted={submitted}
        onSelect={onSelect}
      />
    </div>
  );
}
