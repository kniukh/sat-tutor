"use client";

import { useDeferredValue, useMemo, useState } from "react";
import VocabularyReviewCards from "@/components/student/VocabularyReviewCards";
import {
  deleteStudentVocabularyItem,
  regenerateStudentVocabularyMeaning,
} from "@/services/vocabulary/student-vocabulary-client.service";
import {
  getEffectiveVocabularyDefinition,
  getEffectiveVocabularyTranslation,
} from "@/services/vocabulary/vocabulary-item-overrides";

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
};

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

export default function MyVocabularyPageClient({ studentId, items: initialItems }: Props) {
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = normalizeSearchValue(deferredQuery);

  const filteredItems = useMemo(() => {
    if (!normalizedQuery) {
      return items;
    }

    return items.filter((item) => {
      const definition = getEffectiveVocabularyDefinition(item) ?? "";
      const translation = getEffectiveVocabularyTranslation(item) ?? "";

      return [item.item_text, definition, translation]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [items, normalizedQuery]);

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
              {items.length} active words
            </span>
            {normalizedQuery ? (
              <span className="app-chip app-chip-secondary">
                {filteredItems.length} matching
              </span>
            ) : null}
          </div>

          <label className="block">
            <span className="sr-only">Search vocabulary</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search a word, meaning, or translation"
              className="w-full rounded-[1.2rem] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3 text-sm token-text-primary outline-none transition placeholder:text-slate-400 focus:border-[var(--color-primary)] focus:bg-[var(--color-surface)]"
            />
          </label>
        </div>
      </section>

      <section className="card-surface p-4 sm:p-5">
        <VocabularyReviewCards
          items={filteredItems}
          embedded
          title={normalizedQuery ? "Search Results" : "All Captured Words"}
          emptyTitle={normalizedQuery ? "No matching words" : "No vocabulary yet"}
          emptyCopy={
            normalizedQuery
              ? "Try a different search term."
              : "Capture words from reading lessons and they will show up here."
          }
          onRequestAudio={handleRequestAudio}
          onDeleteItem={handleDelete}
          onRegenerateItem={handleRegenerate}
        />
      </section>
    </div>
  );
}
