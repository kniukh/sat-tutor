type Props = {
  currentIndex: number;
  total: number;
};

export default function ExerciseProgressHeader({
  currentIndex,
  total,
}: Props) {
  const completed = Math.min(currentIndex + 1, total);
  const progressPercent = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div>
      <div className="sr-only">Exercise {completed} of {total}</div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
      </div>
    </div>
  );
}
