import ExerciseOptionList from "../ExerciseOptionList";
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
  focused = false,
  feedbackReward,
  renderCaptureText,
}: ExerciseRendererProps<FillBlankExerciseData>) {
  const sentenceText = getExerciseSentenceText(exercise);

  return (
    <div className="space-y-3">
      {sentenceText ? (
        <div
          className={`text-[1rem] font-semibold leading-7 text-slate-950 sm:text-[1.05rem] ${
            focused ? "drill-context-inline" : "drill-context-surface"
          }`}
        >
          {renderCaptureText
            ? renderCaptureText({
                text: sentenceText,
                contextText: sentenceText,
                as: "div",
              })
            : sentenceText}
        </div>
      ) : null}

      {exercise.variant === "context_clue" && exercise.contextHint ? (
        <div
          className={`text-[0.96rem] leading-7 text-slate-800 sm:text-base ${
            focused ? "drill-context-inline" : "drill-context-surface"
          }`}
        >
          {renderCaptureText
            ? renderCaptureText({
                text: exercise.contextHint,
                contextText: sentenceText,
                as: "div",
              })
            : exercise.contextHint}
        </div>
      ) : null}

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
                contextText: sentenceText,
                isDistractor,
              })
            : option.label
        }
      />
    </div>
  );
}
