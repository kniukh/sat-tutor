import ExerciseOptionList from "../ExerciseOptionList";
import {
  getExerciseCorrectAnswer,
  getExerciseSentenceText,
} from "@/types/vocab-exercises";
import type { CollocationExerciseData, ExerciseRendererProps } from "../types";

export default function CollocationExercise({
  exercise,
  selectedValue,
  onSelect,
  submitted,
  focused = false,
  renderCaptureText,
}: ExerciseRendererProps<CollocationExerciseData>) {
  const isPairSelection = exercise.variant === "pair_selection";
  const contextText = exercise.exampleSentence ?? getExerciseSentenceText(exercise);
  const stemText =
    isPairSelection && exercise.pairLead ? `${exercise.pairLead} ____` : exercise.stem;

  return (
    <div className="space-y-3">
      <div className={focused ? "space-y-1 px-0.5" : "drill-context-surface"}>
        <div className="text-[1.15rem] font-semibold leading-[1.2] text-slate-950 sm:text-[1.35rem]">
          {renderCaptureText
            ? renderCaptureText({
                text: stemText,
                contextText,
                as: "div",
              })
            : stemText}
        </div>
        {contextText ? (
          <div className={`${focused ? "" : "mt-2"} text-sm leading-6 text-slate-600`}>
            {renderCaptureText
              ? renderCaptureText({
                  text: contextText,
                  contextText,
                  as: "div",
                })
              : contextText}
          </div>
        ) : null}
      </div>

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
                contextText,
                isDistractor,
              })
            : option.label
        }
      />
    </div>
  );
}
