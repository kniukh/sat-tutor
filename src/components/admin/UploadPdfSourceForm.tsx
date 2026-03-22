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
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border bg-white p-6">
      <h2 className="text-xl font-semibold text-slate-900">Upload PDF Book</h2>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Book title"
        className="w-full rounded-xl border px-3 py-2 text-slate-900"
      />

      <input
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        placeholder="Author"
        className="w-full rounded-xl border px-3 py-2 text-slate-900"
      />

      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="w-full rounded-xl border px-3 py-2 text-slate-900"
      />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-600">{message}</p> : null}

      <button
        type="submit"
        disabled={isPending || !title || !file}
        className="rounded-xl bg-slate-900 px-5 py-3 text-white disabled:opacity-50"
      >
        {isPending ? 'Uploading...' : 'Upload PDF'}
      </button>
    </form>
  );
}