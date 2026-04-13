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
    streakCount?: number;
    translationText?: string | null;
    translationLabel?: string | null;
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
  const hasHotStreak = (feedback?.streakCount ?? 0) >= 3;
  const feedbackTitle = feedback?.isCorrect
    ? hasHotStreak
      ? "Hot streak."
      : "Nice work."
    : "Not quite.";
  const feedbackHint = feedback?.isCorrect
    ? hasHotStreak
      ? `${feedback?.streakCount} correct in a row. Keep the rhythm.`
      : "Locked in. Keep the pace going."
    : "You still get the next rep right away, so keep the rhythm.";
  const focusedButtonClass =
    "min-h-14 w-full rounded-[1.25rem] bg-[var(--color-primary)] px-5 py-3 text-base font-semibold text-white shadow-[var(--shadow-button)] transition-all duration-150 hover:bg-[var(--color-primary-hover)] active:translate-y-[1px] active:scale-[0.985] disabled:cursor-not-allowed disabled:border disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-500";
  const hasFocusedFeedbackContent = Boolean(
    feedback &&
      ((!feedback.isCorrect && feedback.correctAnswer) ||
        (feedback.isCorrect && feedback.translationText))
  );
  const buttonLabel = submitted
    ? feedback?.isCorrect
      ? "Correct"
      : "Incorrect"
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

      {submitted && feedback && !focused ? (
        <div
          aria-live="polite"
          className={`mb-3 rounded-[20px] border px-4 py-3 shadow-sm ${toneClass}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
                <MascotCat
                  mood={feedback.isCorrect ? (hasHotStreak ? "celebrate" : "correct") : "incorrect"}
                  size="sm"
                />
                <div>
                  <div className="text-sm font-semibold">{feedbackTitle}</div>
                  <div className="text-xs text-current/70">
                    {feedback.isCorrect
                      ? hasHotStreak
                        ? "The cat is fully locked in."
                        : "The cat approves."
                      : "The cat is still with you."}
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
          {feedback.isCorrect && feedback.translationText ? (
            <div className="mt-1 text-sm leading-6">
              <span className="font-semibold">
                {feedback.translationLabel ?? "Translation"}:
              </span>{" "}
              <span className="text-current/85">{feedback.translationText}</span>
            </div>
          ) : null}
          {feedback.explanation ? (
            <div className="mt-3 rounded-2xl border border-current/15 bg-white/70 px-3 py-3 text-sm leading-6 text-slate-700">
              {feedback.explanation}
            </div>
          ) : null}
        </div>
      ) : null}

      {focused && submitted && feedback && hasFocusedFeedbackContent ? (
        <div
          aria-live="polite"
          className={`mb-3 rounded-[1.35rem] border px-4 py-3 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)] ${
            feedback.isCorrect
              ? "border-emerald-200 bg-emerald-50"
              : "border-rose-200 bg-rose-50"
          }`}
        >
          <div
            className={`mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
              feedback.isCorrect ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {feedback.isCorrect ? "Translation" : "Correct Spelling"}
          </div>
          {!feedback.isCorrect && feedback.correctAnswer ? (
            <div className="token-text-primary text-base font-semibold leading-6 sm:text-[1.05rem]">
              <span className="font-semibold text-rose-700">Correct Spelling:</span>{" "}
              {feedback.correctAnswer}
            </div>
          ) : null}
          {feedback.isCorrect && feedback.translationText ? (
            <div className="token-text-primary text-base font-semibold leading-6 sm:text-[1.05rem]">
              <span className="font-semibold text-emerald-700">
                {feedback.translationLabel ?? "Translation"}:
              </span>{" "}
              {feedback.translationText}
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
        {!focused ? (
          <div aria-live="polite" className="min-h-6 flex-1 text-sm font-medium">
            {submitted && feedback ? (
              <span className={feedback.isCorrect ? "text-emerald-600" : "text-rose-600"}>
                {feedback.isCorrect ? "Correct" : "Incorrect"}
              </span>
            ) : (
              <span className="text-slate-400">
                {helperText ?? (canSubmit ? "Ready to continue" : "Choose an answer to continue")}
              </span>
            )}
          </div>
        ) : null}
        <button
          type="button"
          disabled={!canSubmit || submitted || isAdvancing}
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
