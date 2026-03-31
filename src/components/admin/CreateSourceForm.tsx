'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type ChapterItem = {
  number: number;
  name: string;
  text: string;
};

function createEmptyChapter(index: number): ChapterItem {
  return {
    number: index + 1,
    name: '',
    text: '',
  };
}

export function CreateSourceForm() {
  const router = useRouter();
  const [contentType, setContentType] = useState<'book' | 'article' | 'poem'>('book');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [rawText, setRawText] = useState('');
  const [coverMode, setCoverMode] = useState<'auto' | 'upload' | 'none'>('auto');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [chapters, setChapters] = useState<ChapterItem[]>([createEmptyChapter(0)]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isBook = contentType === 'book';
  const submitDisabled = useMemo(() => {
    if (!title.trim()) {
      return true;
    }

    if (isBook) {
      return chapters.every((chapter) => !chapter.text.trim());
    }

    return !rawText.trim();
  }, [chapters, isBook, rawText, title]);

  function updateChapter(index: number, next: Partial<ChapterItem>) {
    setChapters((current) =>
      current.map((chapter, currentIndex) =>
        currentIndex === index ? { ...chapter, ...next } : chapter
      )
    );
  }

  function addChapter() {
    setChapters((current) => [...current, createEmptyChapter(current.length)]);
  }

  function removeChapter(index: number) {
    setChapters((current) => {
      const next = current.filter((_, currentIndex) => currentIndex !== index);
      return next.length > 0
        ? next.map((chapter, currentIndex) => ({
            ...chapter,
            number: currentIndex + 1,
          }))
        : [createEmptyChapter(0)];
    });
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('author', author);
      formData.append('sourceType', contentType);
      formData.append('rawText', rawText);
      formData.append('coverMode', coverMode);
      formData.append('chaptersJson', JSON.stringify(chapters));

      if (coverFile) {
        formData.append('coverFile', coverFile);
      }

      const response = await fetch('/api/admin/sources', {
        method: 'POST',
        body: formData,
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        setError(json?.error ?? 'Failed to create content');
        return;
      }

      setTitle('');
      setAuthor('');
      setRawText('');
      setCoverMode('auto');
      setCoverFile(null);
      setChapters([createEmptyChapter(0)]);
      router.push(`/admin/sources/${json?.data?.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="card-surface space-y-4 p-6">
      <div>
        <div className="app-kicker">Create Content</div>
        <h2 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-slate-950">
          Books, articles, and poems
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Add content once, then run chunking and AI lesson generation inside the existing review flow.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(['book', 'article', 'poem'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setContentType(value)}
            className={`rounded-[1rem] border px-4 py-3 text-sm font-semibold capitalize ${
              contentType === value
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-[var(--color-border)] bg-white text-slate-900'
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={isBook ? 'Book name' : 'Title'}
        className="w-full rounded-[1rem] border border-[var(--color-border)] px-3 py-2 text-slate-900"
      />

      <input
        value={author}
        onChange={(event) => setAuthor(event.target.value)}
        placeholder={contentType === 'article' ? 'Author or source (optional)' : 'Author'}
        className="w-full rounded-[1rem] border border-[var(--color-border)] px-3 py-2 text-slate-900"
      />

      {isBook ? (
        <div className="space-y-3 rounded-[1.25rem] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
          <div className="app-kicker text-slate-500">Cover</div>

          <div className="grid gap-3 sm:grid-cols-3">
            {(['auto', 'upload', 'none'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setCoverMode(value)}
                className={`rounded-[1rem] border px-3 py-2 text-sm font-semibold capitalize ${
                  coverMode === value
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-[var(--color-border)] bg-white text-slate-900'
                }`}
              >
                {value === 'auto' ? 'Auto-fetch' : value}
              </button>
            ))}
          </div>

          {coverMode === 'upload' ? (
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)}
              className="w-full rounded-[1rem] border border-[var(--color-border)] bg-white px-3 py-2 text-slate-900"
            />
          ) : (
            <div className="text-sm text-slate-500">
              {coverMode === 'auto'
                ? 'The system will try to fetch a cover from the book title and author.'
                : 'No cover will be attached.'}
            </div>
          )}
        </div>
      ) : null}

      {isBook ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="app-kicker">Chapters</div>
              <div className="mt-1 text-sm text-slate-600">
                Add book chapters in reading order. These feed the existing chapter-based chunking pipeline.
              </div>
            </div>

            <button type="button" onClick={addChapter} className="secondary-button">
              Add Chapter
            </button>
          </div>

          <div className="space-y-4">
            {chapters.map((chapter, index) => (
              <div key={index} className="rounded-[1.25rem] border border-[var(--color-border)] bg-white p-4">
                <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)_auto]">
                  <input
                    type="number"
                    value={chapter.number}
                    onChange={(event) =>
                      updateChapter(index, { number: Number(event.target.value) || index + 1 })
                    }
                    className="w-full rounded-[1rem] border border-[var(--color-border)] px-3 py-2 text-slate-900"
                    placeholder="No."
                  />

                  <input
                    value={chapter.name}
                    onChange={(event) => updateChapter(index, { name: event.target.value })}
                    className="w-full rounded-[1rem] border border-[var(--color-border)] px-3 py-2 text-slate-900"
                    placeholder="Chapter name"
                  />

                  <button
                    type="button"
                    onClick={() => removeChapter(index)}
                    className="secondary-button"
                  >
                    Remove
                  </button>
                </div>

                <textarea
                  value={chapter.text}
                  onChange={(event) => updateChapter(index, { text: event.target.value })}
                  rows={8}
                  className="mt-3 w-full rounded-[1rem] border border-[var(--color-border)] px-3 py-3 text-sm leading-7 text-slate-900"
                  placeholder="Paste chapter text"
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <textarea
          value={rawText}
          onChange={(event) => setRawText(event.target.value)}
          placeholder={contentType === 'poem' ? 'Paste poem text' : 'Paste article text'}
          rows={16}
          className="w-full rounded-[1rem] border border-[var(--color-border)] px-3 py-3 text-sm leading-7 text-slate-900"
        />
      )}

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <button
        type="submit"
        disabled={isPending || submitDisabled}
        className="primary-button disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? 'Creating...' : 'Create Content'}
      </button>
    </form>
  );
}
