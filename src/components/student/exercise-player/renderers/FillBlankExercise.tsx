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
  return (
    <div className="space-y-5">
      <ExercisePromptPanel
        eyebrow={exercise.prompt}
        title={getExerciseSentenceText(exercise)}
        footer={exercise.clue ? <>Clue: {exercise.clue}</> : undefined}
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
