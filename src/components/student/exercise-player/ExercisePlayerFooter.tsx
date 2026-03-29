type Props = {
  submitted: boolean;
  canSubmit: boolean;
  isLast: boolean;
  feedback: {
    isCorrect: boolean;
    explanation?: string;
  } | null;
  onCheck: () => void;
  onContinue: () => void;
};

export default function ExercisePlayerFooter({
  submitted,
  canSubmit,
  isLast,
  feedback,
  onCheck,
  onContinue,
}: Props) {
  return (
    <div className="space-y-4">
      {submitted && feedback ? (
        <div
          aria-live="polite"
          className={`rounded-[24px] border p-4 transition-all duration-200 sm:p-5 ${
            feedback.isCorrect
              ? "border-emerald-200 bg-emerald-50/90 text-slate-900"
              : "border-amber-200 bg-amber-50/90 text-slate-900"
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                feedback.isCorrect ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"
              }`}
            >
              {feedback.isCorrect ? "OK" : "!"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">
                {feedback.isCorrect ? "Correct" : "Not quite"}
              </div>
              <div className="mt-1 text-sm text-slate-700">
                {feedback.isCorrect
                  ? "Nice work. You can move straight to the next one."
                  : "Take a second to compare your choice with the explanation below."}
              </div>
            </div>
          </div>
          {feedback.explanation ? (
            <div className="mt-4 rounded-2xl border border-black/5 bg-white/70 p-4 text-sm leading-6 text-slate-700">
              {feedback.explanation}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-[24px] border border-slate-200 bg-white/95 p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-500">
            {submitted
              ? isLast
                ? "Review finished. Finish when you are ready."
                : "Feedback saved. Continue when you are ready."
              : canSubmit
                ? "Answer selected. Check it when ready."
                : "Choose one answer to continue."}
          </div>

          <div className="flex justify-end">
            {!submitted ? (
              <button
                type="button"
                disabled={!canSubmit}
                onClick={onCheck}
                className="min-w-32 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
              >
                Check
              </button>
            ) : (
              <button
                type="button"
                onClick={onContinue}
                className="min-w-32 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-emerald-500"
              >
                {isLast ? "Finish" : "Continue"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
