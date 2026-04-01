import ExerciseOptionList from "../ExerciseOptionList";
import AudioExercisePrompt from "../AudioExercisePrompt";
import { getExerciseCorrectAnswer } from "@/types/vocab-exercises";
import type { ExerciseRendererProps, ListenMatchExerciseData } from "../types";

export default function ListenMatchExercise({
  exercise,
  selectedValue,
  onSelect,
  submitted,
  feedbackReward,
}: ExerciseRendererProps<ListenMatchExerciseData>) {
  return (
    <div className="space-y-3">
      <AudioExercisePrompt
        exercise={exercise}
        fallbackContent={<>Audio is unavailable for this listening exercise right now.</>}
      />

      <ExerciseOptionList
        options={exercise.options}
        selectedOptionId={selectedValue || null}
        correctOptionId={getExerciseCorrectAnswer(exercise)}
        submitted={submitted}
        feedbackReward={feedbackReward}
        onSelect={onSelect}
      />
    </div>
  );
}
