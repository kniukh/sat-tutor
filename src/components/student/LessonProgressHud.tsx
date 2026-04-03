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
      <div className="surface-panel rounded-2xl p-4 shadow-lg backdrop-blur">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <div className="token-text-muted text-xs">Part</div>
            <div className="token-text-primary mt-1 text-sm font-semibold">
              {partLabel ?? '-'}
            </div>
          </div>

          <div>
            <div className="token-text-muted text-xs">Stage</div>
            <div className="token-text-primary mt-1 text-sm font-semibold capitalize">
              {formatStage(stage)}
            </div>
          </div>

          <div>
            <div className="token-text-muted text-xs">Words collected</div>
            <div className="token-text-primary mt-1 text-sm font-semibold">
              {collectedWordsCount}
            </div>
          </div>

          <div>
            <div className="token-text-muted text-xs">Questions left</div>
            <div className="token-text-primary mt-1 text-sm font-semibold">
              {questionsLeft}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
