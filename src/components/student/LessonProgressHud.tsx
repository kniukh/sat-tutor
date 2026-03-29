type Props = {
  partLabel?: string | null;
  stage: string;
  collectedWordsCount: number;
  totalQuestions: number;
  answeredQuestions: number;
};

function formatStage(stage: string) {
  return stage.replace(/_/g, ' ');
}

export default function LessonProgressHud({
  partLabel,
  stage,
  collectedWordsCount,
  totalQuestions,
  answeredQuestions,
}: Props) {
  const questionsLeft =
    totalQuestions > 0 ? Math.max(totalQuestions - answeredQuestions, 0) : 0;

  return (
    <div className="sticky top-4 z-20">
      <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <div className="text-xs text-slate-500">Part</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {partLabel ?? '-'}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500">Stage</div>
            <div className="mt-1 text-sm font-semibold capitalize text-slate-900">
              {formatStage(stage)}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500">Words collected</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {collectedWordsCount}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500">Questions left</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {questionsLeft}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
