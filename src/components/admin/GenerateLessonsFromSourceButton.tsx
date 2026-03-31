'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type UnitItem = {
  id: string;
  name: string;
};

export default function GenerateLessonsFromSourceButton({
  sourceDocumentId,
  disabled = false,
}: {
  sourceDocumentId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [unitId, setUnitId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    async function loadUnits() {
      const response = await fetch('/api/admin/units');
      const json = await response.json().catch(() => null);

      if (!response.ok) {
        setError(json?.error ?? 'Failed to load units');
        return;
      }

      const items = json?.data ?? [];
      setUnits(items);
      if (items.length > 0) {
        setUnitId(items[0].id);
      }
    }

    loadUnits();
  }, []);

  function onClick() {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const response = await fetch('/api/admin/sources/generate-lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceDocumentId, unitId }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        setError(json?.error ?? 'Failed to generate lessons');
        return;
      }

      setMessage(`Created ${json?.createdCount ?? 0} lesson${json?.createdCount === 1 ? '' : 's'}.`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <select
        value={unitId}
        onChange={(event) => setUnitId(event.target.value)}
        className="rounded-[1rem] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-slate-900"
      >
        {units.map((unit) => (
          <option key={unit.id} value={unit.id}>
            {unit.name}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={onClick}
        disabled={isPending || !unitId || disabled}
        className="primary-button disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? 'Generating...' : 'Generate AI Lessons'}
      </button>

      {message ? <div className="text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="text-sm text-rose-600">{error}</div> : null}
    </div>
  );
}
