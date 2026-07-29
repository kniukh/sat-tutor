"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import VocabularyReviewCards from "@/components/student/VocabularyReviewCards";
import {
  deleteStudentVocabularyItem,
  regenerateStudentVocabularyMeaning,
} from "@/services/vocabulary/student-vocabulary-client.service";
import { studentVocabularyListPath } from "@/lib/routes/student";

type VocabularyListItem = {
  id: string;
  item_text: string;
  canonical_lemma?: string | null;
  english_explanation?: string | null;
  translated_explanation?: string | null;
  example_text?: string | null;
  context_sentence?: string | null;
  audio_url?: string | null;
  student_definition_override?: string | null;
  student_translation_override?: string | null;
  definition_override_generated_from_context?: boolean | null;
};

type Props = {
  studentId: string;
  items: VocabularyListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    query: string;
  };
};

export default function MyVocabularyPageClient({
  studentId,
  items: initialItems,
  pagination,
}: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState(pagination.query);
  const visibleTotal = Math.max(0, pagination.totalItems - (initialItems.length - items.length));

  async function handleDelete(item: VocabularyListItem) {
    await deleteStudentVocabularyItem({
      studentId,
      vocabularyItemId: item.id,
    });

    setItems((current) => current.filter((entry) => entry.id !== item.id));
  }

  async function handleRegenerate(item: VocabularyListItem) {
    const updatedItem = await regenerateStudentVocabularyMeaning({
      studentId,
      vocabularyItemId: item.id,
      contextText: item.context_sentence ?? item.example_text ?? null,
    });

    setItems((current) =>
      current.map((entry) => (entry.id === item.id ? { ...entry, ...updatedItem } : entry))
    );

    return updatedItem;
  }

  async function handleRequestAudio(options?: {
    force?: boolean;
    itemTexts?: string[];
  }) {
    const response = await fetch("/api/vocabulary/regenerate-audio", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        itemTexts: options?.itemTexts ?? null,
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(payload?.error ?? "Failed to load audio");
    }

    const nextItems = Array.isArray(payload?.items) ? payload.items : [];

    if (nextItems.length > 0) {
      setItems((current) =>
        current.map((entry) => {
          const match = nextItems.find((candidate) => candidate.id === entry.id);
          return match ? { ...entry, ...match } : entry;
        })
      );
    }

    return nextItems;
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(
      studentVocabularyListPath({
        q: query.trim() || null,
        page: "1",
      })
    );
  }

  return (
    <div className="space-y-4">
      <section className="card-surface p-4 sm:p-5">
        <div className="space-y-4">
          <div className="space-y-1">
            <div className="app-kicker">My Vocabulary</div>
            <h1 className="app-heading-lg">Your word list</h1>
            <p className="app-copy">
              Clean up saved words, refresh meanings with context, and replay audio anytime.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="app-chip app-chip-secondary">
              {visibleTotal} active words
            </span>
            {pagination.query ? (
              <span className="app-chip app-chip-secondary">
                Search results
              </span>
            ) : null}
            {pagination.totalPages > 1 ? (
              <span className="app-chip app-chip-secondary">
                Page {pagination.page} of {pagination.totalPages}
              </span>
            ) : null}
          </div>

          <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:flex-row">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Search vocabulary</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search a word, meaning, or translation"
                className="w-full rounded-[1.2rem] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3 text-sm token-text-primary outline-none transition placeholder:text-slate-400 focus:border-[var(--color-primary)] focus:bg-[var(--color-surface)]"
              />
            </label>
            <button type="submit" className="primary-button min-h-12 px-5">
              Search
            </button>
            {pagination.query ? (
              <Link
                href={studentVocabularyListPath()}
                className="secondary-button min-h-12 px-5"
              >
                Clear
              </Link>
            ) : null}
          </form>
        </div>
      </section>

      <section className="card-surface p-4 sm:p-5">
        <VocabularyReviewCards
          items={items}
          embedded
          title={pagination.query ? "Search Results" : "All Captured Words"}
          emptyTitle={pagination.query ? "No matching words" : "No vocabulary yet"}
          emptyCopy={
            pagination.query
              ? "Try a different search term."
              : "Capture words from reading lessons and they will show up here."
          }
          onRequestAudio={handleRequestAudio}
          onDeleteItem={handleDelete}
          onRegenerateItem={handleRegenerate}
        />

        {pagination.totalPages > 1 ? (
          <nav
            aria-label="Vocabulary pages"
            className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-4"
          >
            {pagination.page > 1 ? (
              <Link
                href={studentVocabularyListPath({
                  q: pagination.query || null,
                  page: String(pagination.page - 1),
                })}
                className="secondary-button min-h-11"
              >
                Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="token-text-muted text-sm">
              {pagination.page} / {pagination.totalPages}
            </span>
            {pagination.page < pagination.totalPages ? (
              <Link
                href={studentVocabularyListPath({
                  q: pagination.query || null,
                  page: String(pagination.page + 1),
                })}
                className="secondary-button min-h-11"
              >
                Next
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </section>
    </div>
  );
}
