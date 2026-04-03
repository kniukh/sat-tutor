'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function CreateStudentForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [nativeLanguage, setNativeLanguage] = useState<'ru' | 'ro' | 'en'>('ru');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function makeAccessCode(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '')
      .replace(/-+/g, '');
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const response = await fetch('/api/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, accessCode, nativeLanguage }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        setError(json?.error ?? 'Failed to create student');
        return;
      }

      setFullName('');
      setEmail('');
      setAccessCode('');
      setNativeLanguage('ru');
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="surface-panel space-y-4 rounded-2xl p-6">
      <h2 className="token-text-primary text-xl font-semibold">Create Student</h2>

      <input
        value={fullName}
        onChange={(e) => {
          const value = e.target.value;
          setFullName(value);
          if (!accessCode) {
            setAccessCode(makeAccessCode(value));
          }
        }}
        placeholder="Full name"
        className="surface-soft-panel token-text-primary w-full rounded-xl border border-[var(--color-border)] px-3 py-2"
      />

      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="surface-soft-panel token-text-primary w-full rounded-xl border border-[var(--color-border)] px-3 py-2"
      />

      <input
        value={accessCode}
        onChange={(e) => setAccessCode(makeAccessCode(e.target.value))}
        placeholder="Access code"
        className="surface-soft-panel token-text-primary w-full rounded-xl border border-[var(--color-border)] px-3 py-2"
      />

      <select
        value={nativeLanguage}
        onChange={(e) => setNativeLanguage(e.target.value as 'ru' | 'ro' | 'en')}
        className="surface-soft-panel token-text-primary w-full rounded-xl border border-[var(--color-border)] px-3 py-2"
      >
        <option value="ru">ru</option>
        <option value="ro">ro</option>
        <option value="en">en</option>
      </select>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={isPending || !fullName || !accessCode}
        className="primary-button disabled:opacity-50"
      >
        {isPending ? 'Creating...' : 'Create Student'}
      </button>
    </form>
  );
}
