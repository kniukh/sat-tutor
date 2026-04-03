'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? 'Login failed');
        return;
      }

      router.push('/admin');
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="surface-panel mx-auto max-w-md space-y-4 rounded-2xl p-6 shadow-sm"
    >
      <div>
        <h1 className="token-text-primary text-2xl font-semibold">Admin login</h1>
        <p className="token-text-secondary mt-1 text-sm">Sign in to admin panel</p>
      </div>

      <label className="block">
        <span className="token-text-secondary mb-1 block text-sm font-medium">Email</span>
        <input
          className="surface-soft-panel token-text-primary w-full rounded-xl border border-[var(--color-border)] px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>

      <label className="block">
        <span className="token-text-secondary mb-1 block text-sm font-medium">Password</span>
        <input
          type="password"
          className="surface-soft-panel token-text-primary w-full rounded-xl border border-[var(--color-border)] px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="primary-button w-full justify-center disabled:opacity-50"
      >
        {isPending ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
}
