type Props = {
  currentIndex: number;
  total: number;
  focused?: boolean;
};

export default function ExerciseProgressHeader({
  currentIndex,
  total,
  focused = false,
}: Props) {
  const completed = Math.min(currentIndex + 1, total);
  const progressPercent = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className={focused ? "space-y-2" : "space-y-3"}>
      {!focused ? (
        <div className="flex items-center justify-between gap-3 text-sm">
          <div className="font-medium text-slate-500">
            {completed} / {total}
          </div>
          <div className="text-slate-400">{Math.round(progressPercent)}%</div>
        </div>
      ) : null}
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-slate-950 transition-[width] duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
