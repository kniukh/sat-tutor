'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { studentDashboardPath } from '@/lib/routes/student';

export function StudentLoginForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const normalizedCode = code.trim();
    if (!normalizedCode) {
      setError('Введите код ученика');
      return;
    }

    startTransition(async () => {
      const response = await fetch('/api/student/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ access_code: normalizedCode }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? 'Не удалось выполнить вход. Проверьте код и попробуйте снова.');
        return;
      }

      router.push(studentDashboardPath());
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="surface-panel mx-auto max-w-md space-y-4 rounded-2xl p-6 shadow-sm">
      <div>
        <h1 className="token-text-primary text-2xl font-semibold">Student login</h1>
        <p className="token-text-secondary mt-1 text-sm">Введите код доступа ученика, чтобы перейти к дашборду</p>
      </div>

      <label className="block">
        <span className="token-text-secondary mb-1 block text-sm font-medium">Код доступа</span>
        <input
          className="surface-soft-panel token-text-primary w-full rounded-xl border border-[var(--color-border)] px-3 py-2"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="0000"
          aria-label="Student access code"
        />
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="primary-button w-full justify-center disabled:opacity-50"
      >
        {isPending ? 'Вход...' : 'Войти'}
      </button>
    </form>
  );
}

