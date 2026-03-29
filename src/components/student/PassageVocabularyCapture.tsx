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

export type CapturedVocabularyItem = {
  itemText: string;
  itemType: "word" | "phrase";
  sourceType: "passage" | "question" | "answer";
  contextText?: string | null;
};

type Props = {
  studentId: string;
  lessonId: string;
  passageId?: string;
  presetItems?: CapturedVocabularyItem[];
  onItemsChange?: (items: CapturedVocabularyItem[]) => void;
  onSubmitted?: (items: VocabItem[]) => void;
  compact?: boolean;
  hideManualInput?: boolean;
};

export default function PassageVocabularyCapture({
  studentId,
  lessonId,
  passageId,
  presetItems = [],
  onItemsChange,
  onSubmitted,
  compact = false,
  hideManualInput = false,
}: Props) {
  const [items, setItems] = useState<CapturedVocabularyItem[]>(presetItems);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

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
      for (const item of items) {
        await fetch("/api/vocabulary/capture-inline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId,
            lessonId,
            passageId,
            itemText: item.itemText,
            itemType: item.itemType,
            sourceType: item.sourceType,
            contextText: item.contextText ?? null,
          }),
        });
      }

      const generatedResponse = await fetch("/api/vocabulary/generate-from-captures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, lessonId }),
      });

      const generatedJson = await generatedResponse.json();

      await fetch("/api/lesson/submit-vocabulary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, lessonId }),
      });

      onSubmitted?.(generatedJson.items ?? []);
    } catch (error) {
      console.error("submitVocabulary error", error);
      alert("Failed to submit vocabulary");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`space-y-4 ${compact ? "" : ""}`}>
      <div className={compact ? "text-sm font-semibold text-slate-900" : "text-lg font-semibold"}>
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
            className="flex-1 rounded-lg border px-3 py-2"
            placeholder="Type a word or phrase"
          />
          <button
            onClick={addItem}
            className="rounded-lg bg-black px-4 py-2 text-white"
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
            className="px-3 py-1 rounded-full bg-blue-100 text-blue-900"
          >
            {item.itemText} ×
          </button>
        ))}
      </div>

      <button
        onClick={submitVocabulary}
        disabled={saving}
        className={`rounded-lg text-white disabled:opacity-50 ${
          compact ? "px-4 py-2 text-sm bg-slate-950" : "px-4 py-2 bg-green-600"
        }`}
      >
        {saving ? "Submitting..." : compact ? "Review Words" : "Submit Vocabulary"}
      </button>
    </div>
  );
}
