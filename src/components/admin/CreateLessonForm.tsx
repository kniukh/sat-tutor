'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type UnitItem = {
  id: string;
  name: string;
  slug: string;
  collections?: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

export function CreateLessonForm() {
  const router = useRouter();
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [unitId, setUnitId] = useState('');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [lessonType, setLessonType] = useState('reading_vocab');
  const [status, setStatus] = useState('draft');
  const [error, setError] = useState<string | null>(null);
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    async function loadUnits() {
      const response = await fetch('/api/admin/units');
      const json = await response.json();

      if (!response.ok) {
        setError(json?.error ?? 'Failed to load units');
        setLoadingUnits(false);
        return;
      }

      setUnits(json.data ?? []);
      if (json.data?.length > 0) {
        setUnitId(json.data[0].id);
      }
      setLoadingUnits(false);
    }

    loadUnits();
  }, []);

  function makeSlug(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const response = await fetch('/api/admin/lessons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          unitId,
          name,
          slug,
          lessonType,
          status,
        }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        setError(json?.error ?? 'Failed to create lesson');
        return;
      }

      setName('');
      setSlug('');
      setLessonType('reading_vocab');
      setStatus('draft');
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="surface-panel space-y-4 rounded-2xl p-6">
      <div>
        <h2 className="token-text-primary text-xl font-semibold">Create Lesson</h2>
        <p className="token-text-secondary mt-1 text-sm">Minimal admin create form</p>
      </div>

      {loadingUnits ? (
        <p className="token-text-muted text-sm">Loading units...</p>
      ) : (
        <label className="block">
          <span className="token-text-secondary mb-1 block text-sm font-medium">Unit</span>
          <select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            className="surface-soft-panel token-text-primary w-full rounded-xl border border-[var(--color-border)] px-3 py-2"
          >
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.collections?.name ? `${unit.collections.name} / ` : ''}
                {unit.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block">
        <span className="token-text-secondary mb-1 block text-sm font-medium">Lesson name</span>
        <input
          value={name}
          onChange={(e) => {
            const value = e.target.value;
            setName(value);
            setSlug(makeSlug(value));
          }}
          className="surface-soft-panel token-text-primary w-full rounded-xl border border-[var(--color-border)] px-3 py-2"
          placeholder="Lesson 2"
        />
      </label>

      <label className="block">
        <span className="token-text-secondary mb-1 block text-sm font-medium">Slug</span>
        <input
          value={slug}
          onChange={(e) => setSlug(makeSlug(e.target.value))}
          className="surface-soft-panel token-text-primary w-full rounded-xl border border-[var(--color-border)] px-3 py-2"
          placeholder="lesson-2"
        />
      </label>

      <label className="block">
        <span className="token-text-secondary mb-1 block text-sm font-medium">Lesson type</span>
        <select
          value={lessonType}
          onChange={(e) => setLessonType(e.target.value)}
          className="surface-soft-panel token-text-primary w-full rounded-xl border border-[var(--color-border)] px-3 py-2"
        >
          <option value="reading_vocab">reading_vocab</option>
          <option value="vocab_drill">vocab_drill</option>
          <option value="real_test">real_test</option>
          <option value="math_drill">math_drill</option>
          <option value="quiz">quiz</option>
        </select>
      </label>

      <label className="block">
        <span className="token-text-secondary mb-1 block text-sm font-medium">Status</span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="surface-soft-panel token-text-primary w-full rounded-xl border border-[var(--color-border)] px-3 py-2"
        >
          <option value="draft">draft</option>
          <option value="review">review</option>
          <option value="published">published</option>
          <option value="archived">archived</option>
        </select>
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={isPending || loadingUnits || !unitId || !name || !slug}
        className="primary-button disabled:opacity-50"
      >
        {isPending ? 'Creating...' : 'Create Lesson'}
      </button>
    </form>
  );
}
