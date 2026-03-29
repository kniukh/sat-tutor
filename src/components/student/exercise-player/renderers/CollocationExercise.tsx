import ExerciseOptionList from "../ExerciseOptionList";
import ExercisePromptPanel from "../ExercisePromptPanel";
import {
  getExerciseCorrectAnswer,
  getExerciseSentenceText,
  getExerciseTargetWord,
} from "@/types/vocab-exercises";
import type { CollocationExerciseData, ExerciseRendererProps } from "../types";

export default function CollocationExercise({
  exercise,
  selectedValue,
  onSelect,
  submitted,
}: ExerciseRendererProps<CollocationExerciseData>) {
  return (
    <div className="space-y-5">
      <ExercisePromptPanel
        eyebrow={exercise.prompt}
        body={
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Build the phrase
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800">
                Target: {getExerciseTargetWord(exercise)}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-[0.85fr_1.15fr]">
              <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5 text-white shadow-[0_18px_35px_-24px_rgba(15,23,42,0.8)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  Phrase Stem
                </div>
                <div className="mt-3 text-2xl font-semibold tracking-tight">{exercise.stem}</div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                Choose the option that forms the most natural English pairing, not just a word that
                fits grammatically.
              </div>
            </div>

            {exercise.exampleSentence || getExerciseSentenceText(exercise) ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  In Use
                </div>
                <div className="mt-2 text-base leading-7 text-slate-800">
                  {exercise.exampleSentence ?? getExerciseSentenceText(exercise)}
                </div>
              </div>
            ) : null}
          </div>
        }
      />

      <ExerciseOptionList
        options={exercise.options}
        selectedOptionId={selectedValue || null}
        correctOptionId={getExerciseCorrectAnswer(exercise)}
        submitted={submitted}
        onSelect={onSelect}
      />
    </div>
  );
}
