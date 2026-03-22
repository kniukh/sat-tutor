'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

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

      router.push(`/s/${encodeURIComponent(normalizedCode)}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-md space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Student login</h1>
        <p className="mt-1 text-sm text-slate-600">Введите код доступа ученика, чтобы перейти к дашборду</p>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Код доступа</span>
        <input
          className="w-full rounded-xl border px-3 py-2 text-slate-900"
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
        className="w-full rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {isPending ? 'Вход...' : 'Войти'}
      </button>
    </form>
  );
}
