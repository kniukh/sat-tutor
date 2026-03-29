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

type Props = {
  studentId: string;
  lessonId: string;
  passageId?: string;
  presetItems?: string[];
  onItemsChange?: (items: string[]) => void;
  onSubmitted?: (items: VocabItem[]) => void;
};

export default function PassageVocabularyCapture({
  studentId,
  lessonId,
  passageId,
  presetItems = [],
  onItemsChange,
  onSubmitted,
}: Props) {
  const [items, setItems] = useState<string[]>(presetItems);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setItems(presetItems);
  }, [presetItems]);

  function sync(next: string[]) {
    setItems(next);
    onItemsChange?.(next);
  }

  function addItem() {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (items.some((x) => x.toLowerCase() === trimmed.toLowerCase())) return;
    sync([...items, trimmed]);
    setValue("");
  }

  function removeItem(item: string) {
    sync(items.filter((x) => x !== item));
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
            itemText: item,
            itemType: item.includes(" ") ? "phrase" : "word",
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
    <div className="space-y-4">
      <div className="text-lg font-semibold">Unknown words and phrases</div>

      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addItem();
          }}
          className="flex-1 border rounded-lg px-3 py-2"
          placeholder="Type a word or phrase"
        />
        <button
          onClick={addItem}
          className="px-4 py-2 rounded-lg bg-black text-white"
        >
          Add
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item}
            onClick={() => removeItem(item)}
            className="px-3 py-1 rounded-full bg-blue-100 text-blue-900"
          >
            {item} ×
          </button>
        ))}
      </div>

      <button
        onClick={submitVocabulary}
        disabled={saving}
        className="px-4 py-2 rounded-lg bg-green-600 text-white disabled:opacity-50"
      >
        {saving ? "Submitting..." : "Submit Vocabulary"}
      </button>
    </div>
  );
}