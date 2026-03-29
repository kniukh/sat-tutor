"use client";

import { useMemo, useState } from "react";

type VocabItem = {
  id: string;
  item_text: string;
  english_explanation?: string | null;
  translated_explanation?: string | null;
  example_text?: string | null;
  context_sentence?: string | null;
  audio_url?: string | null;
};

type Props = {
  items: VocabItem[];
  onDone?: () => void;
};

export default function VocabularyReviewCards({ items, onDone }: Props) {
  const [index, setIndex] = useState(0);

  const item = useMemo(() => items[index], [items, index]);

  if (!items.length) {
    return (
      <div className="space-y-3">
        <div className="text-lg font-semibold">Vocabulary review</div>
        <div>No vocabulary cards yet.</div>
        <button
          onClick={onDone}
          className="px-4 py-2 rounded-lg bg-black text-white"
        >
          Continue
        </button>
      </div>
    );
  }

  function next() {
    if (index >= items.length - 1) {
      onDone?.();
      return;
    }
    setIndex((prev) => prev + 1);
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="text-sm text-gray-500">
        Card {index + 1} of {items.length}
      </div>

      <div className="border rounded-2xl p-5 bg-white space-y-3">
        <div className="text-2xl font-bold">{item.item_text}</div>

        <div>
          <div className="text-sm text-gray-500">Meaning</div>
          <div>{item.english_explanation || "-"}</div>
        </div>

        <div>
          <div className="text-sm text-gray-500">Translation</div>
          <div>{item.translated_explanation || "-"}</div>
        </div>

        <div>
          <div className="text-sm text-gray-500">Example</div>
          <div>{item.example_text || "-"}</div>
        </div>

        <div>
          <div className="text-sm text-gray-500">Meaning in context</div>
          <div>{item.context_sentence || "-"}</div>
        </div>

        {item.audio_url ? (
          <div className="pt-2">
            <audio controls src={item.audio_url} className="w-full" />
          </div>
        ) : (
          <div className="text-sm text-amber-600">Audio not ready yet</div>
        )}
      </div>

      <button
        onClick={next}
        className="px-4 py-2 rounded-lg bg-black text-white"
      >
        {index >= items.length - 1 ? "Continue" : "Next"}
      </button>
    </div>
  );
}