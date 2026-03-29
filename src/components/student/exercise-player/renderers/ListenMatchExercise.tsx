import ExerciseOptionList from "../ExerciseOptionList";
import AudioExercisePrompt from "../AudioExercisePrompt";
import { getExerciseCorrectAnswer } from "@/types/vocab-exercises";
import type { ExerciseRendererProps, ListenMatchExerciseData } from "../types";

export default function ListenMatchExercise({
  exercise,
  selectedValue,
  onSelect,
  submitted,
}: ExerciseRendererProps<ListenMatchExerciseData>) {
  return (
    <div className="space-y-5">
      <AudioExercisePrompt
        exercise={exercise}
        title="Listen, then choose the matching word."
        description="Play the audio and pick the word you hear from the bank below."
        readyHint="Use the audio first. The written answer stays hidden until you make your choice."
        fallbackContent={
          <>
            Fallback prompt: match the word <span className="font-semibold">{exercise.target_word}</span>.
          </>
        }
        footer={
          exercise.explanation ? (
            <>Audio-based recognition with word-bank matching.</>
          ) : (
            <>Listen first, then choose from the options.</>
          )
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
