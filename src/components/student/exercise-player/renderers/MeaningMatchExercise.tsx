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
  renderCaptureText,
}: ExerciseRendererProps<MeaningMatchExerciseData>) {
  const isTranslation = exercise.type === "translation_match";
  const displayTerm =
    isTranslation && "promptTerm" in exercise && exercise.promptTerm
      ? exercise.promptTerm
      : getExerciseTargetWord(exercise);
  const footer = isTranslation
    ? exercise.direction === "native_to_english"
      ? `${exercise.sourceLanguageLabel ?? "Native"} to ${exercise.targetLanguageLabel ?? "English"}`
      : `${exercise.sourceLanguageLabel ?? "English"} to ${exercise.targetLanguageLabel ?? "Native"}`
    : `${exercise.sourceLanguageLabel ?? "English"} to ${exercise.targetLanguageLabel ?? "Meaning"} matching`;

  return (
    <div className="space-y-5">
      <ExercisePromptPanel
        eyebrow={exercise.prompt}
        title={
          renderCaptureText
            ? renderCaptureText({
                text: displayTerm,
                contextText: footer,
              })
            : displayTerm
        }
        footer={<>{footer}</>}
      />

      <ExerciseOptionList
        options={exercise.options}
        selectedOptionId={selectedValue || null}
        correctOptionId={getExerciseCorrectAnswer(exercise)}
        submitted={submitted}
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
    </div>
  );
}
