import type { ExerciseOption } from "./types";
import type { ReactNode } from "react";

type Props = {
  options: ExerciseOption[];
  selectedOptionId: string | null;
  correctOptionId: string;
  submitted: boolean;
  onSelect: (optionId: string) => void;
  renderOptionLabel?: (params: {
    option: ExerciseOption;
    isDistractor: boolean;
  }) => ReactNode;
};

export default function ExerciseOptionList({
  options,
  selectedOptionId,
  correctOptionId,
  submitted,
  onSelect,
  renderOptionLabel,
}: Props) {
  function moveSelection(currentId: string | null, direction: 1 | -1) {
    const currentIndex = Math.max(
      0,
      options.findIndex((option) => option.id === currentId)
    );
    const nextIndex = (currentIndex + direction + options.length) % options.length;
    onSelect(options[nextIndex]?.id ?? options[0]?.id ?? "");
  }

  return (
    <div className="space-y-2" role="radiogroup" aria-label="Answer choices">
      {options.map((option, index) => {
        const isSelected = selectedOptionId === option.id;
        const isCorrect = submitted && option.id === correctOptionId;
        const isWrongSelected =
          submitted && isSelected && option.id !== correctOptionId;
        const optionState = isCorrect
          ? "correct"
          : isWrongSelected
            ? "incorrect"
            : isSelected
              ? "selected"
              : "idle";

        return (
          <button
            key={option.id}
            type="button"
            disabled={submitted}
            onClick={() => onSelect(option.id)}
            onKeyDown={(event) => {
              if (submitted) return;

              if (event.key === "ArrowDown" || event.key === "ArrowRight") {
                event.preventDefault();
                moveSelection(selectedOptionId, 1);
                return;
              }

              if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
                event.preventDefault();
                moveSelection(selectedOptionId, -1);
                return;
              }

              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(option.id);
              }
            }}
            role="radio"
            aria-checked={isSelected}
            aria-disabled={submitted}
            data-state={optionState}
            className="drill-option group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            <div className="flex items-start gap-3">
              <div className="drill-option-indicator mt-0.5">
                {submitted ? (isCorrect ? "OK" : isWrongSelected ? "NO" : index + 1) : index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[0.96rem] font-medium leading-[1.45] sm:text-base">
                  {renderOptionLabel
                    ? renderOptionLabel({
                        option,
                        isDistractor: option.id !== correctOptionId,
                      })
                    : option.label}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
