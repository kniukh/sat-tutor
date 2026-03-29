import type { ExerciseOption } from "./types";

type Props = {
  options: ExerciseOption[];
  selectedOptionId: string | null;
  correctOptionId: string;
  submitted: boolean;
  onSelect: (optionId: string) => void;
};

export default function ExerciseOptionList({
  options,
  selectedOptionId,
  correctOptionId,
  submitted,
  onSelect,
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
    <div className="space-y-3" role="radiogroup" aria-label="Answer choices">
      {options.map((option, index) => {
        const isSelected = selectedOptionId === option.id;
        const isCorrect = submitted && option.id === correctOptionId;
        const isWrongSelected =
          submitted && isSelected && option.id !== correctOptionId;
        const optionStateClass = isCorrect
          ? "border-emerald-500 bg-emerald-50 text-slate-950"
          : isWrongSelected
            ? "border-rose-400 bg-rose-50 text-slate-950"
            : isSelected
              ? "border-slate-950 bg-slate-950 text-white"
              : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50";
        const indicatorClass = isCorrect
          ? "border-emerald-500 bg-emerald-500 text-white"
          : isWrongSelected
            ? "border-rose-400 bg-rose-400 text-white"
            : isSelected
              ? "border-white/80 bg-white text-slate-950"
              : "border-slate-300 bg-white text-slate-400";

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
            className={`group block w-full rounded-[20px] border px-4 py-4 text-left transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-100 ${optionStateClass}`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${indicatorClass}`}
              >
                {submitted ? (isCorrect ? "OK" : isWrongSelected ? "NO" : index + 1) : index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-base font-medium leading-relaxed">{option.label}</div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
