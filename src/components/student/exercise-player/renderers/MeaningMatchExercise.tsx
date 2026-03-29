import ExerciseOptionList from "../ExerciseOptionList";
import ExercisePromptPanel from "../ExercisePromptPanel";
import {
  getExerciseCorrectAnswer,
  getExerciseTargetWord,
} from "@/types/vocab-exercises";
import type { ExerciseRendererProps, MeaningMatchExerciseData } from "../types";

export default function MeaningMatchExercise({
  exercise,
  selectedValue,
  onSelect,
  submitted,
}: ExerciseRendererProps<MeaningMatchExerciseData>) {
  return (
    <div className="space-y-5">
      <ExercisePromptPanel
        eyebrow={exercise.prompt}
        title={getExerciseTargetWord(exercise)}
        footer={
          <>
            {exercise.sourceLanguageLabel ?? "Source"} to{" "}
            {exercise.targetLanguageLabel ?? "target"}
          </>
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
