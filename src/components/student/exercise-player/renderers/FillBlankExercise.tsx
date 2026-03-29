import ExerciseOptionList from "../ExerciseOptionList";
import ExercisePromptPanel from "../ExercisePromptPanel";
import {
  getExerciseCorrectAnswer,
  getExerciseSentenceText,
} from "@/types/vocab-exercises";
import type { ExerciseRendererProps, FillBlankExerciseData } from "../types";

export default function FillBlankExercise({
  exercise,
  selectedValue,
  onSelect,
  submitted,
}: ExerciseRendererProps<FillBlankExerciseData>) {
  const footer =
    exercise.variant === "context_clue"
      ? "Use both the blanked sentence and the extra context clue before you choose."
      : exercise.clue
        ? `Use the clue if you need it: ${exercise.clue}`
        : "Choose the word that makes the sentence feel natural and meaningful.";

  return (
    <div className="space-y-5">
      <ExercisePromptPanel
        eyebrow={exercise.prompt}
        title={getExerciseSentenceText(exercise)}
        body={
          exercise.variant === "context_clue" && exercise.contextHint ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Extra Context
              </div>
              <div className="mt-2 text-base leading-7 text-slate-800">{exercise.contextHint}</div>
            </div>
          ) : undefined
        }
        footer={<>{footer}</>}
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
