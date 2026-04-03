"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    href: "/admin",
    label: "Overview",
    match: (pathname: string) => pathname === "/admin",
  },
  {
    href: "/admin/students",
    label: "Students",
    match: (pathname: string) => pathname.startsWith("/admin/students"),
  },
  {
    href: "/admin/insights",
    label: "Insights",
    match: (pathname: string) =>
      pathname.startsWith("/admin/insights") ||
      pathname.startsWith("/admin/skills") ||
      pathname.startsWith("/admin/vocabulary"),
  },
  {
    href: "/admin/lessons",
    label: "Content",
    match: (pathname: string) => pathname.startsWith("/admin/lessons"),
  },
  {
    href: "/admin/sources",
    label: "Sources",
    match: (pathname: string) => pathname.startsWith("/admin/sources"),
  },
];

export function AdminShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-lg font-semibold token-text-primary">SAT Tutor Admin</div>
            <div className="text-sm token-text-muted">Structured control for students, insights, content, and sources.</div>
          </div>

          <nav className="flex flex-wrap gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  item.match(pathname)
                    ? "border-[var(--color-surface-inverse)] bg-[var(--color-surface-inverse)] text-[var(--color-text-inverse)]"
                    : "border-[var(--color-border-strong)] bg-[var(--color-surface)] token-text-primary hover:bg-[var(--color-surface-muted)]"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div>
            <div className="app-kicker">Admin</div>
            <h1 className="mt-1 text-3xl font-semibold tracking-[-0.02em] token-text-primary">{title}</h1>
            {subtitle ? <p className="mt-2 max-w-3xl text-sm leading-6 token-text-secondary">{subtitle}</p> : null}
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}
