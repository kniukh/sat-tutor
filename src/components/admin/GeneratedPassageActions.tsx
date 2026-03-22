'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type UnitItem = {
  id: string;
  name: string;
};

export default function GeneratedPassageActions({
  generatedPassageId,
  status,
  lessonId,
}: {
  generatedPassageId: string;
  status: string;
  lessonId?: string | null;
}) {
  const router = useRouter();
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [unitId, setUnitId] = useState('');
  const [error, setError] = useState<string | null>(null);
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

  function updateStatus(nextStatus: 'approved' | 'rejected') {
    setError(null);

    startTransition(async () => {
      const response = await fetch('/api/admin/passages/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generatedPassageId, status: nextStatus }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        setError(json?.error ?? 'Failed to update passage');
        return;
      }

      router.refresh();
    });
  }

  function createLesson() {
    setError(null);

    startTransition(async () => {
      const response = await fetch('/api/admin/passages/create-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generatedPassageId, unitId }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        setError(json?.error ?? 'Failed to create lesson');
        return;
      }

      router.push(`/admin/lessons/${json.data.id}`);
      router.refresh();
    });
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => updateStatus('approved')}
          className="rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
        >
          Approve
        </button>

        <button
          type="button"
          disabled={isPending}
          onClick={() => updateStatus('rejected')}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-900 disabled:opacity-50"
        >
          Reject
        </button>
      </div>

      {!lessonId ? (
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            className="rounded-xl border px-3 py-2 text-slate-900"
          >
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={isPending || !unitId}
            onClick={createLesson}
            className="rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
          >
            Create Lesson
          </button>
        </div>
      ) : (
        <a
          href={`/admin/lessons/${lessonId}`}
          className="inline-block rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-900"
        >
          Open Lesson
        </a>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="text-sm text-slate-500">Status: {status}</div>
    </div>
  );
}