type Props = {
  currentIndex: number;
  total: number;
  submitted?: boolean;
  comboCount?: number;
  comboMultiplier?: number;
  comboActive?: boolean;
  retryCount?: number;
};

export default function ExerciseProgressHeader({
  currentIndex,
  total,
  submitted = false,
  comboCount = 0,
  comboMultiplier,
  comboActive = false,
  retryCount = 0,
}: Props) {
  const completed = Math.min(currentIndex + (submitted ? 2 : 1), total);
  const progressPercent = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className="space-y-2 pt-0.5">
      <div className="flex items-center justify-between gap-3 text-xs font-semibold text-[var(--color-text-muted)]">
        <span>Exercise {completed} of {total}</span>
        {retryCount > 0 ? (
          <span className="rounded-full border border-amber-300/50 bg-amber-100/80 px-2 py-1 text-amber-800">
            {retryCount} reinforcement {retryCount === 1 ? "rep" : "reps"}
          </span>
        ) : null}
      </div>
      {comboCount >= 2 ? (
        <div className="flex justify-end">
          <div className="combo-chip" data-active={comboActive ? "true" : "false"}>
            <span>{`🔥 Combo x${comboCount}`}</span>
            {comboMultiplier && comboMultiplier > 1 ? (
              <span className="text-current/75">{`+${Math.round((comboMultiplier - 1) * 100)}% XP`}</span>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
      </div>
    </div>
  );
}
