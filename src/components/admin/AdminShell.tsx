import type { ReactNode } from 'react';
import Link from 'next/link';

const navItems = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/lessons', label: 'Lessons' },
  { href: '/admin/sources', label: 'Sources' },
  { href: '/admin/students', label: 'Students' },
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
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <div className="text-lg font-semibold text-slate-900">SAT Tutor Admin</div>
            <div className="text-sm text-slate-500">Content and student management</div>
          </div>

          <nav className="flex flex-wrap gap-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 hover:bg-slate-50"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="px-6 py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">{title}</h1>
            {subtitle ? <p className="mt-2 text-slate-600">{subtitle}</p> : null}
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}
