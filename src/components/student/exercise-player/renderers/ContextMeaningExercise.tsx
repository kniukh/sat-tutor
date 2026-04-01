import ExerciseOptionList from "../ExerciseOptionList";
import { getExerciseCorrectAnswer } from "@/types/vocab-exercises";
import type {
  ContextMeaningExerciseData,
  ExerciseRendererProps,
} from "../types";

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderHighlightedContext(
  contextText: string,
  focusText: string,
  renderCaptureText?: ExerciseRendererProps<ContextMeaningExerciseData>["renderCaptureText"]
) {
  if (!focusText.trim()) {
    return renderCaptureText
      ? renderCaptureText({
          text: contextText,
          contextText,
        })
      : contextText;
  }

  const pattern = new RegExp(`(${escapeRegExp(focusText)})`, "gi");
  const parts = contextText.split(pattern);

  return parts.map((part, index) =>
    part.toLowerCase() === focusText.toLowerCase() ? (
      renderCaptureText ? (
        <span key={`${part}-${index}`}>
          {renderCaptureText({
            text: part,
            contextText,
            highlightText: focusText,
          })}
        </span>
      ) : (
        <mark
          key={`${part}-${index}`}
          className="rounded-md bg-amber-200/80 px-1.5 py-0.5 font-semibold text-slate-950"
        >
          {part}
        </mark>
      )
    ) : (
      <span key={`${part}-${index}`}>
        {renderCaptureText
          ? renderCaptureText({
              text: part,
              contextText,
            })
          : part}
      </span>
    )
  );
}

export default function ContextMeaningExercise({
  exercise,
  selectedValue,
  onSelect,
  submitted,
  focused = false,
  feedbackReward,
  renderCaptureText,
}: ExerciseRendererProps<ContextMeaningExerciseData>) {
  return (
    <div className="space-y-3">
      <div
        className={`overflow-hidden text-[0.96rem] leading-7 text-slate-900 sm:text-base ${
          focused ? "drill-context-inline" : "drill-context-surface"
        }`}
      >
        {renderHighlightedContext(
          exercise.contextText,
          exercise.focusText,
          renderCaptureText
        )}
      </div>

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
                contextText: exercise.contextText,
                isDistractor,
              })
            : option.label
        }
      />
    </div>
  );
}
