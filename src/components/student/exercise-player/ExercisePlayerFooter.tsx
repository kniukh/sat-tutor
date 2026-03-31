import MascotCat from "@/components/student/MascotCat";

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
  } | null;
  onCheck: () => void;
  onContinue: () => void;
};

export default function ExercisePlayerFooter({
  submitted,
  canSubmit,
  isLast,
  isAdvancing = false,
  helperText,
  focused = false,
  feedback,
  onCheck,
  onContinue,
}: Props) {
  const toneClass = feedback?.isCorrect
    ? "border-emerald-200 bg-emerald-50 text-emerald-950"
    : "border-rose-200 bg-rose-50 text-rose-950";
  const feedbackTitle = feedback?.isCorrect ? "Nice work." : "Not quite.";
  const feedbackHint = feedback?.isCorrect
    ? "Locked in. Keep the pace going."
    : "You still get the next rep right away, so keep the rhythm.";
  const focusedButtonClass =
    "min-h-14 w-full rounded-[1.125rem] bg-[var(--color-primary)] px-5 py-3 text-base font-semibold text-white shadow-[var(--shadow-button)] transition-all duration-150 hover:bg-[var(--color-primary-hover)] active:scale-[0.99] disabled:cursor-not-allowed disabled:border disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-500";

  return (
    <div className={focused ? "fixed-action-bar" : "-mx-4 border-t border-slate-200 bg-white/95 px-4 pb-4 pt-3 backdrop-blur sm:-mx-0 sm:rounded-b-[24px] sm:border sm:px-5 sm:pb-5"}>
      {focused && submitted && feedback ? (
        <div aria-live="polite" className="sr-only">
          {feedback.isCorrect ? "Correct. Continue." : "Incorrect. Continue."}
        </div>
      ) : null}

      {submitted && feedback && !focused ? (
        <div
          aria-live="polite"
          className={`mb-3 rounded-[20px] border px-4 py-3 shadow-sm ${toneClass}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <MascotCat mood={feedback.isCorrect ? "correct" : "incorrect"} size="sm" />
              <div>
                <div className="text-sm font-semibold">{feedbackTitle}</div>
                <div className="text-xs text-current/70">
                  {feedback.isCorrect ? "The cat approves." : "The cat is still with you."}
                </div>
              </div>
            </div>
            {!focused ? (
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-current/70">
                Press Enter to continue
              </div>
            ) : null}
          </div>
          <div className="mt-1 text-sm leading-6 text-current/80">{feedbackHint}</div>
          {feedback.selectedAnswer ? (
            <div className="mt-3 text-sm leading-6">
              <span className="font-semibold">{feedback.answerLabel ?? "Your answer"}:</span>{" "}
              <span className="text-current/85">{feedback.selectedAnswer}</span>
            </div>
          ) : null}
          {!feedback.isCorrect && feedback.correctAnswer ? (
            <div className="mt-1 text-sm leading-6">
              <span className="font-semibold">Correct answer:</span>{" "}
              <span className="text-current/85">{feedback.correctAnswer}</span>
            </div>
          ) : null}
          {feedback.explanation ? (
            <div className="mt-3 rounded-2xl border border-current/15 bg-white/70 px-3 py-3 text-sm leading-6 text-slate-700">
              {feedback.explanation}
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        className={`${
          focused
            ? "fixed-action-bar__inner"
            : ""
        } flex items-center gap-3 ${focused ? "justify-stretch" : ""}`}
      >
        {!focused ? (
          <div aria-live="polite" className="min-h-6 flex-1 text-sm font-medium">
            {submitted && feedback ? (
              <span className={feedback.isCorrect ? "text-emerald-600" : "text-rose-600"}>
                {feedback.isCorrect ? "Correct" : "Incorrect"}
              </span>
            ) : (
              <span className="text-slate-400">
                {helperText ?? (canSubmit ? "Ready to check" : "Choose an answer to continue")}
              </span>
            )}
          </div>
        ) : null}
        {!submitted ? (
          <button
            type="button"
            disabled={!canSubmit || isAdvancing}
            onClick={onCheck}
            className={`rounded-2xl px-5 py-3 text-sm font-semibold text-white transition-all duration-150 active:scale-[0.99] disabled:cursor-not-allowed disabled:border disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-500 ${
              focused
                ? focusedButtonClass
                : "min-w-32 bg-slate-950 hover:bg-slate-800"
            }`}
          >
            Check
          </button>
        ) : (
          <button
            type="button"
            disabled={isAdvancing}
            onClick={onContinue}
            className={`rounded-2xl px-5 py-3 text-sm font-semibold text-white transition-all duration-150 active:scale-[0.99] disabled:cursor-not-allowed disabled:border disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-500 ${
              focused ? focusedButtonClass : "min-w-32"
            } ${
              focused
                ? ""
                : feedback?.isCorrect
                  ? "bg-emerald-600 hover:bg-emerald-500"
                  : "bg-slate-950 hover:bg-slate-800"
            }`}
          >
            {isAdvancing ? "Loading..." : isLast ? "Finish" : "Continue"}
          </button>
        )}
      </div>
    </div>
  );
}
