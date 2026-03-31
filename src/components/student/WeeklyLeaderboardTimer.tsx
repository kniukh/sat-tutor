"use client";

import { useEffect, useMemo, useState } from "react";

function getWeekEndTimestamp(weekStartDate: string) {
  const start = new Date(`${weekStartDate}T00:00:00Z`);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return end.getTime();
}

function formatTimeLeft(weekStartDate: string, now: number) {
  const diffMs = Math.max(0, getWeekEndTimestamp(weekStartDate) - now);
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h left`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m left`;
  }

  return `${minutes}m left`;
}

export default function WeeklyLeaderboardTimer({
  weekStartDate,
}: {
  weekStartDate: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  const label = useMemo(() => formatTimeLeft(weekStartDate, now), [weekStartDate, now]);

  return (
    <div className="inline-flex items-center rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white">
      {label}
    </div>
  );
}
