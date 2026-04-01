import ExerciseOptionList from "../ExerciseOptionList";
import { getExerciseCorrectAnswer } from "@/types/vocab-exercises";
import type { ExerciseRendererProps, MeaningMatchExerciseData } from "../types";

export default function MeaningMatchExercise({
  exercise,
  selectedValue,
  onSelect,
  submitted,
  feedbackReward,
  renderCaptureText,
}: ExerciseRendererProps<MeaningMatchExerciseData>) {
  const isTranslation = exercise.type === "translation_match";
  const footer = isTranslation
    ? exercise.direction === "native_to_english"
      ? `${exercise.sourceLanguageLabel ?? "Native"} to ${exercise.targetLanguageLabel ?? "English"}`
      : `${exercise.sourceLanguageLabel ?? "English"} to ${exercise.targetLanguageLabel ?? "Native"}`
    : `${exercise.sourceLanguageLabel ?? "English"} to ${exercise.targetLanguageLabel ?? "Meaning"} matching`;

  return (
    <ExerciseOptionList
      options={exercise.options}
      selectedOptionId={selectedValue || null}
      correctOptionId={getExerciseCorrectAnswer(exercise)}
      submitted={submitted}
      feedbackReward={feedbackReward}
      onSelect={onSelect}
      renderOptionLabel={({ option, isDistractor }) =>
        renderCaptureText
          ? renderCaptureText({
              text: option.label,
              contextText: footer,
              isDistractor,
            })
          : option.label
      }
    />
  );
}
