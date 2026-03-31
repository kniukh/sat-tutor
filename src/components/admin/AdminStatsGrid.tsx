type StatItem = {
  label: string;
  value: string | number;
};

export function AdminStatsGrid({ items }: { items: StatItem[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => (
        <div key={item.label} className="card-surface p-5">
          <div className="app-kicker text-slate-500">{item.label}</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
