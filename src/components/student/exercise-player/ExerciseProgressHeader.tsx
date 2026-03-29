type Props = {
  currentIndex: number;
  total: number;
  title?: string;
};

export default function ExerciseProgressHeader({ currentIndex, total, title }: Props) {
  const progressPercent = total > 0 ? ((currentIndex + 1) / total) * 100 : 0;

  return (
    <div className="space-y-4 rounded-[28px] border border-slate-200 bg-white/95 p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          {title ? <div className="text-lg font-semibold text-slate-950">{title}</div> : null}
          <div className="text-sm text-slate-500">
            Exercise {Math.min(currentIndex + 1, total)} of {total}
          </div>
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
          {Math.round(progressPercent)}% complete
        </div>
      </div>

      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200/80">
        <div
          className="h-full rounded-full bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-600 transition-[width] duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
