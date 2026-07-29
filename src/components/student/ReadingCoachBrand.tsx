import Link from "next/link";
import { studentDashboardPath } from "@/lib/routes/student";

export function ReadingCoachMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ${className}`}
    >
      <svg viewBox="0 0 48 48" className="h-full w-full" fill="none">
        <path d="M8 12.5c6-2.2 11.3-1.3 16 2.8v24c-4.7-4.1-10-5-16-2.8v-24Z" fill="#fff" stroke="currentColor" strokeWidth="2.2"/>
        <path d="M40 12.5c-6-2.2-11.3-1.3-16 2.8v24c4.7-4.1 10-5 16-2.8v-24Z" fill="#fff" stroke="currentColor" strokeWidth="2.2"/>
        <path d="M24 32c4.6-8.4 8.2-13 13-16.3-3.1 5.5-5 10.6-5.8 15.5-2.7-.2-5.1.1-7.2.8Z" fill="#22c55e"/>
        <path d="M15 20h5M15 25h5M28 20h5" stroke="#93c5fd" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="m35.5 7 1.1 2.8L39.5 11l-2.9 1.1-1.1 2.9-1.1-2.9-2.9-1.1 2.9-1.2L35.5 7Z" fill="#facc15"/>
      </svg>
    </span>
  );
}

export default function ReadingCoachBrand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href={studentDashboardPath()} className="inline-flex items-center gap-3" aria-label="SAT Reading Coach home">
      <ReadingCoachMark className={compact ? "h-9 w-9" : "h-11 w-11"} />
      <span className={compact ? "hidden sm:block" : "block"}>
        <span className="block font-[var(--font-display)] text-sm font-extrabold leading-tight tracking-[-0.02em] text-slate-950">
          SAT Reading
        </span>
        <span className="block font-[var(--font-display)] text-sm font-extrabold leading-tight tracking-[-0.02em] text-blue-600">
          Coach
        </span>
      </span>
    </Link>
  );
}
