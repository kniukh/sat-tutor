"use client";

import { useEffect, useState } from "react";

type VocabItem = {
  id: string;
  item_text: string;
  english_explanation?: string | null;
  translated_explanation?: string | null;
  example_text?: string | null;
  audio_url?: string | null;
};

function hasFallbackLikeVocabularyItems(items: VocabItem[]) {
  return items.some((item) => {
    const english = item.english_explanation?.trim().toLowerCase() ?? "";
    const translated = item.translated_explanation?.trim().toLowerCase() ?? "";

    return (
      !english ||
      english.startsWith(`meaning of "${item.item_text.trim().toLowerCase()}"`) ||
      english.startsWith("meaning of this word in the passage") ||
      english.startsWith("meaning of this phrase in the passage") ||
      translated === item.item_text.trim().toLowerCase()
    );
  });
}

function buildFallbackSubmittedItems(items: CapturedVocabularyItem[], lessonId: string): VocabItem[] {
  return items.map((item, index) => ({
    id: `client-fallback:${lessonId}:${index}:${item.itemText.toLowerCase()}`,
    item_text: item.itemText,
    english_explanation:
      item.preview?.plainEnglishMeaning?.trim() ||
      item.preview?.contextMeaning?.trim() ||
      `Meaning of "${item.itemText}" in the passage.`,
    translated_explanation: item.preview?.translation?.trim() || null,
    example_text:
      item.contextText ??
      item.preview?.contextMeaning?.trim() ??
      null,
    audio_url: null,
  }));
}

export type CapturedVocabularyItem = {
  itemText: string;
  itemType: "word" | "phrase";
  sourceType: "passage" | "question" | "answer" | "vocab_drill";
  contextText?: string | null;
  saveState?: "pending" | "saved";
  preview?: {
    plainEnglishMeaning?: string | null;
    translation?: string | null;
    contextMeaning?: string | null;
  } | null;
};

type Props = {
  studentId: string;
  lessonId: string;
  passageId?: string;
  presetItems?: CapturedVocabularyItem[];
  onItemsChange?: (items: CapturedVocabularyItem[]) => void;
  onSubmitted?: (items: VocabItem[]) => void;
  onContinueCheckpoint?: (items: CapturedVocabularyItem[]) => Promise<void> | void;
  compact?: boolean;
  hideManualInput?: boolean;
  immersive?: boolean;
};

export default function PassageVocabularyCapture({
  studentId,
  lessonId,
  passageId,
  presetItems = [],
  onItemsChange,
  onSubmitted,
  onContinueCheckpoint,
  compact = false,
  hideManualInput = false,
  immersive = false,
}: Props) {
  const [items, setItems] = useState<CapturedVocabularyItem[]>(presetItems);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const pendingCount = items.filter((item) => item.saveState !== "saved").length;
  const savedCount = items.length - pendingCount;

  const preparingHelperText = saving
    ? "Preparing cards now. Practice details can finish loading in the background."
    : null;

  useEffect(() => {
    setItems(presetItems);
  }, [presetItems]);

  function sync(next: CapturedVocabularyItem[]) {
    setItems(next);
    onItemsChange?.(next);
  }

  function addItem() {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (items.some((x) => x.itemText.toLowerCase() === trimmed.toLowerCase())) return;
    sync([
      ...items,
      {
        itemText: trimmed,
        itemType: trimmed.includes(" ") ? "phrase" : "word",
        sourceType: "passage",
        contextText: null,
        saveState: "pending",
      },
    ]);
    setValue("");
  }

  function removeItem(itemText: string) {
    sync(items.filter((x) => x.itemText !== itemText));
  }

  async function submitVocabulary() {
    setSaving(true);

    try {
      if (onContinueCheckpoint) {
        await onContinueCheckpoint(items);
        return;
      }

      const submitResponse = await fetch("/api/lesson/submit-vocabulary", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          lessonId,
          passageId,
          items,
        }),
      });

      const submitJson = await submitResponse.json();

      if (!submitResponse.ok) {
        throw new Error(submitJson?.error ?? "Failed to submit vocabulary");
      }

      const resolvedItems =
        Array.isArray(submitJson?.result?.items) && submitJson.result.items.length > 0
          ? submitJson.result.items
          : buildFallbackSubmittedItems(items, lessonId);

      onSubmitted?.(resolvedItems);

      const shouldHydrateRealCards = hasFallbackLikeVocabularyItems(resolvedItems);

      if (shouldHydrateRealCards) {
        void fetch("/api/vocabulary/generate-from-captures", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId, lessonId }),
        })
          .then((response) => response.json().catch(() => null))
          .then((payload) => {
            if (Array.isArray(payload?.items) && payload.items.length > 0) {
              onSubmitted?.(payload.items);
            }
          })
          .catch((error) => {
            console.error("generate-from-captures background error", error);
          });
      }

      void fetch("/api/vocabulary/prepare-drills", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, lessonId }),
      })
        .then((response) => response.json().catch(() => null))
        .then((payload) => {
          if (Array.isArray(payload?.items) && payload.items.length > 0) {
            onSubmitted?.(payload.items);
          }
        })
        .catch((error) => {
          console.error("prepare-drills background error", error);
        });

      void fetch("/api/vocabulary/regenerate-audio", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, lessonId }),
      })
        .then((response) => response.json().catch(() => null))
        .then((payload) => {
          if (Array.isArray(payload?.items) && payload.items.length > 0) {
            onSubmitted?.(payload.items);
          }
        })
        .catch((error) => {
          console.error("regenerate-audio background error", error);
        });
    } catch (error) {
      console.error("submitVocabulary error", error);
      alert("Failed to submit vocabulary");
    } finally {
      setSaving(false);
    }
  }

  if (immersive) {
    const latestItem = items[items.length - 1]?.itemText ?? null;

    return (
      <>
        {saving ? (
          <div className="vocab-preparing-preview">
            <div className="vocab-preparing-preview__inner">
              <div className="vocab-preparing-preview__header">
                <div className="token-text-primary text-sm font-semibold">Building your review cards</div>
                <div className="token-text-muted text-xs">Meanings first, practice details next.</div>
              </div>
              <div className="vocab-preparing-preview__grid">
                {Array.from({ length: Math.min(Math.max(items.length, 2), 3) }).map((_, index) => (
                  <div key={index} className="vocab-skeleton-card">
                    <div className="vocab-skeleton vocab-skeleton--word" />
                    <div className="vocab-skeleton vocab-skeleton--line" />
                    <div className="vocab-skeleton vocab-skeleton--line-short" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
        <div className="reading-action-bar">
          <div className="reading-action-bar__inner flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="token-text-primary text-sm font-medium">
                {items.length > 0
                  ? `${items.length} word${items.length === 1 ? "" : "s"} in Word Bank`
                  : "Long press any word to save it"}
              </div>
              {preparingHelperText ? (
                <div className="token-text-muted mt-0.5 text-sm">
                  {preparingHelperText}
                </div>
              ) : items.length > 0 ? (
                <div className="token-text-muted mt-0.5 text-sm">
                  {pendingCount > 0 ? `${pendingCount} pending` : "All saved"}
                  {savedCount > 0 ? ` • ${savedCount} saved` : ""}
                </div>
              ) : latestItem ? (
                <div className="token-text-muted mt-0.5 truncate text-sm">
                  Latest: {latestItem}
                </div>
              ) : null}
            </div>

            <button
              onClick={submitVocabulary}
              disabled={saving}
              className="primary-button min-h-14 shrink-0 disabled:opacity-50"
            >
              {saving ? "Preparing cards..." : "Continue"}
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className={`space-y-4 ${compact ? "" : ""}`}>
      <div className={compact ? "token-text-primary text-sm font-semibold" : "token-text-primary text-lg font-semibold"}>
        Unknown words and phrases
      </div>

      {!hideManualInput ? (
        <div className="flex gap-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addItem();
            }}
            className="surface-panel token-text-primary flex-1 rounded-lg border border-[var(--color-border)] px-3 py-2"
            placeholder="Type a word or phrase"
          />
          <button
            onClick={addItem}
            className="secondary-button rounded-lg px-4 py-2"
          >
            Add
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={`${item.sourceType}:${item.itemText}`}
            onClick={() => removeItem(item.itemText)}
            className="rounded-full border border-[var(--color-secondary)] bg-[var(--color-secondary-soft)] px-3 py-1 text-[var(--color-secondary)]"
          >
            {item.itemText} ×
          </button>
        ))}
      </div>

      <button
        onClick={submitVocabulary}
        disabled={saving}
        className={`primary-button disabled:opacity-50 ${
          compact ? "px-4 py-2 text-sm" : "px-4 py-2"
        }`}
      >
        {saving ? "Preparing cards..." : compact ? "Review Words" : "Submit Vocabulary"}
      </button>
      {preparingHelperText ? (
        <div className="token-text-muted text-sm">
          {preparingHelperText}
        </div>
      ) : null}
    </div>
  );
}
