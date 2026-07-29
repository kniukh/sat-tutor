type Props = {
  submitted: boolean;
  canSubmit: boolean;
  isLast: boolean;
  isAdvancing?: boolean;
  helperText?: string | null;
  focused?: boolean;
  feedback: {
    isCorrect: boolean;
    explanation?: string;
    selectedAnswer?: string;
    correctAnswer?: string;
    answerLabel?: string;
    streakCount?: number;
    translationText?: string | null;
    translationLabel?: string | null;
    retryAdded?: boolean;
  } | null;
  onContinue: () => void;
  secondaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  } | null;
};

export default function ExercisePlayerFooter({
  submitted,
  canSubmit,
  isLast,
  isAdvancing = false,
  helperText,
  focused = false,
  feedback,
  onContinue,
  secondaryAction = null,
}: Props) {
  const toneClass = feedback?.isCorrect
    ? "border-emerald-200 bg-emerald-50 text-emerald-950"
    : "border-rose-200 bg-rose-50 text-rose-950";
  const focusedButtonClass =
    "min-h-14 w-full rounded-[1.25rem] bg-[var(--color-primary)] px-5 py-3 text-base font-semibold text-white shadow-[var(--shadow-button)] transition-all duration-150 hover:bg-[var(--color-primary-hover)] active:translate-y-[1px] active:scale-[0.985] disabled:cursor-not-allowed disabled:border disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-500";
  const buttonLabel = submitted
    ? isLast
      ? "Finish"
      : "Continue"
    : isAdvancing
      ? "Loading..."
      : isLast
        ? "Finish"
        : "Continue";

  return (
    <div className={focused ? "fixed-action-bar" : "-mx-4 border-t border-slate-200 bg-white/95 px-4 pb-4 pt-3 backdrop-blur sm:-mx-0 sm:rounded-b-[24px] sm:border sm:px-5 sm:pb-5"}>
      {focused && submitted && feedback ? (
        <div aria-live="polite" className="sr-only">
          {feedback.isCorrect ? "Correct. Continue." : "Incorrect. Continue."}
        </div>
      ) : null}

      {submitted && feedback ? (
        <div
          aria-live="polite"
          className={`mb-3 rounded-[18px] border px-4 py-3 ${toneClass}`}
        >
          {feedback.isCorrect ? (
            <div className="text-base font-semibold text-emerald-700">Correct</div>
          ) : (
            <>
              {feedback.correctAnswer ? (
                <div className="text-sm leading-6">
                  <span className="font-semibold">Correct answer:</span>{" "}
                  <span>{feedback.correctAnswer}</span>
                </div>
              ) : null}
              {feedback.explanation ? (
                <div className="mt-2 text-sm leading-6 text-slate-700">
                  {feedback.explanation}
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <div
        className={`${
          focused
            ? "fixed-action-bar__inner"
            : ""
        } flex items-center gap-3 ${focused ? "justify-stretch" : ""}`}
      >
        {secondaryAction ? (
          <button
            type="button"
            disabled={Boolean(secondaryAction.disabled)}
            onClick={secondaryAction.onClick}
            className={`rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-150 hover:bg-slate-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 ${
              focused ? "min-h-14 shrink-0" : "shrink-0"
            }`}
          >
            {secondaryAction.label}
          </button>
        ) : null}
        {!focused && !submitted ? (
          <div aria-live="polite" className="min-h-6 flex-1 text-sm font-medium">
            <span className="text-slate-400">
              {helperText ?? (canSubmit ? "Ready to continue" : "Choose an answer to continue")}
            </span>
          </div>
        ) : null}
        <button
          type="button"
          disabled={(!submitted && !canSubmit) || isAdvancing}
          onClick={onContinue}
          className={`rounded-2xl px-5 py-3 text-sm font-semibold text-white transition-all duration-150 active:scale-[0.99] disabled:cursor-not-allowed disabled:border disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-500 ${
            focused ? focusedButtonClass : "min-w-32"
          } ${
            focused
              ? ""
              : submitted && feedback?.isCorrect
                ? "bg-emerald-600 shadow-[var(--shadow-button)]"
                : submitted && feedback && !feedback.isCorrect
                  ? "bg-rose-600 shadow-[var(--shadow-button)]"
                  : "bg-[var(--color-primary)] shadow-[var(--shadow-button)] hover:bg-[var(--color-primary-hover)] active:translate-y-[1px] active:scale-[0.985]"
          }`}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}
