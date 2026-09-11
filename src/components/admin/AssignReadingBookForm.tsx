'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type ReadingBookOption = {
  id: string;
  title: string;
  content_mode?: string | null;
  chapters: Array<{ chapter_index: number; chapter_title?: string | null }>;
};

export default function AssignReadingBookForm({ studentId, books }: { studentId: string; books: ReadingBookOption[] }) {
  const router = useRouter();
  const [bookId, setBookId] = useState(books[0]?.id ?? '');
  const selectedBook = useMemo(() => books.find((book) => book.id === bookId) ?? books[0] ?? null, [bookId, books]);
  const [chapterIndex, setChapterIndex] = useState(String(selectedBook?.chapters[0]?.chapter_index ?? ''));
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setChapterIndex(String(selectedBook?.chapters[0]?.chapter_index ?? ''));
  }, [selectedBook]);

  function assign() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const response = await fetch('/api/admin/reading-assignments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, sourceDocumentId: bookId, chapterIndex: Number(chapterIndex) }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) { setError(json?.error ?? 'Failed to assign chapter'); return; }
      setMessage('Chapter assigned');
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select value={bookId} onChange={(event) => setBookId(event.target.value)} className="surface-soft-panel token-text-primary min-w-0 flex-1 rounded-xl border border-[var(--color-border)] px-3 py-2">
          {books.map((book) => <option key={book.id} value={book.id}>{book.title} · {(book.content_mode ?? 'sat').toUpperCase()}</option>)}
        </select>
        <select value={chapterIndex} onChange={(event) => setChapterIndex(event.target.value)} disabled={!selectedBook?.chapters.length} className="surface-soft-panel token-text-primary min-w-0 flex-1 rounded-xl border border-[var(--color-border)] px-3 py-2">
          {selectedBook?.chapters.map((chapter) => <option key={chapter.chapter_index} value={chapter.chapter_index}>{chapter.chapter_title || `Chapter ${chapter.chapter_index}`}</option>)}
        </select>
        <button type="button" onClick={assign} disabled={isPending || !bookId || !chapterIndex} className="primary-button disabled:opacity-50">{isPending ? 'Assigning...' : 'Assign chapter'}</button>
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
    </div>
  );
}
