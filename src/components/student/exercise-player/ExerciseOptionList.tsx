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
  return (
    <div className="space-y-3" role="radiogroup" aria-label="Answer choices">
      <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
        Tap or click to select
      </div>
      {options.map((option, index) => {
        const isSelected = selectedOptionId === option.id;
        const isCorrect = submitted && option.id === correctOptionId;
        const isWrongSelected =
          submitted && isSelected && option.id !== correctOptionId;
        const optionStateClass = isCorrect
          ? "border-emerald-500 bg-emerald-50 text-slate-950 shadow-[0_10px_25px_-18px_rgba(16,185,129,0.8)]"
          : isWrongSelected
            ? "border-rose-400 bg-rose-50 text-slate-950 shadow-[0_10px_25px_-18px_rgba(244,63,94,0.7)]"
            : isSelected
              ? "border-slate-900 bg-slate-950 text-white shadow-[0_16px_30px_-18px_rgba(15,23,42,0.8)]"
              : "border-slate-200 bg-white text-slate-900 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm";
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
            role="radio"
            aria-checked={isSelected}
            aria-disabled={submitted}
            className={`group block w-full rounded-[24px] border px-4 py-4 text-left transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-100 ${optionStateClass}`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${indicatorClass}`}
              >
                {submitted ? (isCorrect ? "OK" : isWrongSelected ? "NO" : index + 1) : index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-base font-medium leading-relaxed">{option.label}</div>
                <div
                  className={`mt-1 text-xs ${
                    isSelected && !submitted ? "text-white/75" : "text-slate-500"
                  }`}
                >
                  {submitted
                    ? isCorrect
                      ? "Correct answer"
                      : isWrongSelected
                        ? "Your choice"
                        : "Not selected"
                    : "Press to choose"}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
