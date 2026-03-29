'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function EditStudentForm({
  student,
}: {
  student: {
    id: string;
    full_name: string;
    email: string | null;
    access_code: string;
    native_language: 'ru' | 'ro' | 'en';
    is_active: boolean;
  };
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(student.full_name);
  const [email, setEmail] = useState(student.email || '');
  const [accessCode, setAccessCode] = useState(student.access_code);
  const [nativeLanguage, setNativeLanguage] = useState<'ru' | 'ro' | 'en'>(
    student.native_language,
  );
  const [isActive, setIsActive] = useState(student.is_active);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const response = await fetch('/api/admin/students/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.id,
          fullName,
          email,
          accessCode,
          nativeLanguage,
          isActive,
        }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        setError(json?.error ?? 'Failed to update student');
        return;
      }

      setMessage('Saved');
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border bg-white p-6">
      <h2 className="text-xl font-semibold text-slate-900">Edit Student</h2>

      <input
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        className="w-full rounded-xl border px-3 py-2 text-slate-900"
      />

      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-xl border px-3 py-2 text-slate-900"
      />

      <input
        value={accessCode}
        onChange={(e) => setAccessCode(e.target.value)}
        className="w-full rounded-xl border px-3 py-2 text-slate-900"
      />

      <select
        value={nativeLanguage}
        onChange={(e) => setNativeLanguage(e.target.value as 'ru' | 'ro' | 'en')}
        className="w-full rounded-xl border px-3 py-2 text-slate-900"
      >
        <option value="ru">ru</option>
        <option value="ro">ro</option>
        <option value="en">en</option>
      </select>

      <label className="flex items-center gap-3 text-slate-900">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        Active
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-600">{message}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-xl bg-slate-900 px-5 py-3 text-white disabled:opacity-50"
      >
        {isPending ? 'Saving...' : 'Save changes'}
      </button>
    </form>
  );
}
