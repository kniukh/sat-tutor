type Props = {
  submitted: boolean;
  canSubmit: boolean;
  isLast: boolean;
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
  feedback,
  onCheck,
  onContinue,
}: Props) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 border-t border-slate-200 bg-white/95 px-4 pb-4 pt-3 backdrop-blur sm:-mx-0 sm:rounded-b-[24px] sm:border sm:px-5 sm:pb-5">
      <div className="flex items-center gap-3">
        <div aria-live="polite" className="min-h-6 flex-1 text-sm font-medium">
          {submitted && feedback ? (
            <span className={feedback.isCorrect ? "text-emerald-600" : "text-rose-600"}>
              {feedback.isCorrect ? "Correct" : "Incorrect"}
            </span>
          ) : (
            <span className="text-slate-400">{canSubmit ? "Ready" : "Select an answer"}</span>
          )}
        </div>
        {!submitted ? (
          <button
            type="button"
            disabled={!canSubmit}
            onClick={onCheck}
            className="min-w-32 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
          >
            Check
          </button>
        ) : (
          <button
            type="button"
            onClick={onContinue}
            className={`min-w-32 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 ${
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
