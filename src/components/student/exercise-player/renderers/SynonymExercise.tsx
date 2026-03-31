import ExerciseOptionList from "../ExerciseOptionList";
import {
  getExerciseCorrectAnswer,
  getExerciseSentenceText,
} from "@/types/vocab-exercises";
import type { ExerciseRendererProps, SynonymExerciseData } from "../types";

export default function SynonymExercise({
  exercise,
  selectedValue,
  onSelect,
  submitted,
  focused = false,
  renderCaptureText,
}: ExerciseRendererProps<SynonymExerciseData>) {
  return (
    <div className="space-y-3">
      {getExerciseSentenceText(exercise) ? (
        <div
          className={`text-[0.96rem] leading-7 text-slate-800 sm:text-base ${
            focused ? "drill-context-inline" : "drill-context-surface"
          }`}
        >
          {renderCaptureText
            ? renderCaptureText({
                text: getExerciseSentenceText(exercise),
                contextText: getExerciseSentenceText(exercise),
                as: "div",
              })
            : getExerciseSentenceText(exercise)}
        </div>
      ) : null}

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
                contextText: getExerciseSentenceText(exercise),
                isDistractor,
              })
            : option.label
        }
      />
    </div>
  );
}
