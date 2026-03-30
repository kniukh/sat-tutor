type Props = {
  submitted: boolean;
  canSubmit: boolean;
  isLast: boolean;
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
  focused = false,
  feedback,
  onCheck,
  onContinue,
}: Props) {
  return (
    <div
      className={`sticky bottom-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur ${
        focused
          ? "-mx-4 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 sm:-mx-6 sm:px-6"
          : "-mx-4 px-4 pb-4 pt-3 sm:-mx-0 sm:rounded-b-[24px] sm:border sm:px-5 sm:pb-5"
      }`}
    >
      <div className={`flex items-center gap-3 ${focused ? "justify-stretch" : ""}`}>
        {!focused ? (
          <div aria-live="polite" className="min-h-6 flex-1 text-sm font-medium">
            {submitted && feedback ? (
              <span className={feedback.isCorrect ? "text-emerald-600" : "text-rose-600"}>
                {feedback.isCorrect ? "Correct" : "Incorrect"}
              </span>
            ) : (
              <span className="text-slate-400">{canSubmit ? "Ready" : "Select an answer"}</span>
            )}
          </div>
        ) : null}
        {!submitted ? (
          <button
            type="button"
            disabled={!canSubmit}
            onClick={onCheck}
            className={`rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 ${
              focused ? "w-full" : "min-w-32"
            }`}
          >
            Check
          </button>
        ) : (
          <button
            type="button"
            onClick={onContinue}
            className={`rounded-2xl px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 ${
              focused ? "w-full" : "min-w-32"
            } ${
              feedback?.isCorrect ? "bg-emerald-600 hover:bg-emerald-500" : "bg-slate-950 hover:bg-slate-800"
            }`}
          >
            {isLast ? "Finish" : "Continue"}
          </button>
        )}
      </div>
    </div>
  );
}
