'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function UploadPdfSourceForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!file) {
      setError('Please choose a PDF file');
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('author', author);
      formData.append('file', file);

      const response = await fetch('/api/admin/sources/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        setError(json?.error ?? 'Upload failed');
        return;
      }

      setTitle('');
      setAuthor('');
      setFile(null);
      setMessage(`Uploaded. Pages extracted: ${json?.pagesCount ?? 0}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="card-surface space-y-4 p-6">
      <div>
        <div className="app-kicker">Upload Book PDF</div>
        <h2 className="token-text-primary mt-1 text-2xl font-semibold tracking-[-0.02em]">Import a full book</h2>
        <p className="token-text-secondary mt-2 text-sm leading-6">
          Extract pages first, then use the existing structure and chunk pipeline before generating AI lessons.
        </p>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Book title"
        className="surface-panel token-text-primary w-full rounded-[1rem] border border-[var(--color-border)] px-3 py-2"
      />

      <input
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        placeholder="Author"
        className="surface-panel token-text-primary w-full rounded-[1rem] border border-[var(--color-border)] px-3 py-2"
      />

      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="surface-panel token-text-primary w-full rounded-[1rem] border border-[var(--color-border)] px-3 py-2"
      />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-600">{message}</p> : null}

      <button
        type="submit"
        disabled={isPending || !title || !file}
        className="primary-button disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? 'Uploading...' : 'Upload PDF'}
      </button>
    </form>
  );
}
