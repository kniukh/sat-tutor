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
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
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
      const queueResponse = await fetch(
        `/api/admin/sources/generate-lessons?sourceDocumentId=${encodeURIComponent(sourceDocumentId)}`
      );
      const queueJson = await queueResponse.json().catch(() => null);
      if (!queueResponse.ok) {
        setError(queueJson?.error ?? 'Failed to load generation queue');
        return;
      }

      const pending = Array.isArray(queueJson?.pending) ? queueJson.pending : [];
      let createdCount = 0;
      const failures: Array<{ passageId: string; error: string }> = [];
      setProgress({ current: 0, total: pending.length });

      for (let index = 0; index < pending.length; index += 1) {
        setProgress({ current: index + 1, total: pending.length });
        setMessage(`Generating chunk ${index + 1} of ${pending.length}…`);
        const response = await fetch('/api/admin/sources/generate-lessons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceDocumentId,
            unitId,
            generatedPassageId: pending[index].id,
          }),
        });
        const json = await response.json().catch(() => null);
        if (!response.ok) {
          failures.push({
            passageId: pending[index].id,
            error: json?.error ?? 'Request failed',
          });
          continue;
        }
        createdCount += Number(json?.createdCount ?? 0);
        failures.push(...(Array.isArray(json?.failed) ? json.failed : []));
      }

      const failedCount = failures.length;
      const skippedCount = Number(queueJson?.data?.length ?? 0) - pending.length;
      setMessage(
        `Created ${createdCount}, skipped ${skippedCount}, failed ${failedCount}.` +
          (failedCount > 0 ? ' Retry to process only the failed chunks.' : '')
      );
      setProgress(null);
      if (failedCount > 0) {
        const firstFailure = failures[0];
        setError(
          firstFailure
            ? `Chunk ${firstFailure.passageId}: ${firstFailure.error}`
            : 'Some chunks failed.'
        );
      }
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
        {isPending
          ? progress
            ? `Generating ${progress.current}/${progress.total}`
            : 'Preparing…'
          : 'Generate AI Lessons'}
      </button>

      {message ? <div className="text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="text-sm text-rose-600">{error}</div> : null}
    </div>
  );
}
