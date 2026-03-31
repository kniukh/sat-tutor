"use client";

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
  if (!items.length) {
    return (
      <div className="mx-auto flex min-h-[calc(100svh-12rem)] max-w-3xl flex-col justify-center px-4 py-8 text-center sm:px-6">
        <div className="card-surface space-y-3 px-6 py-8">
          <div className="text-2xl font-semibold text-slate-950">Nothing saved this time</div>
          <div className="text-sm leading-6 text-slate-600">
            Continue to the second read and keep moving through the passage.
          </div>
        </div>
        <button
          onClick={onDone}
          className="primary-button mt-5"
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100svh-12rem)] max-w-3xl flex-col px-4 py-4 sm:px-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-slate-950">Saved from this passage</h2>
        <div className="text-sm leading-6 text-slate-600">
          Take a quick look, then continue reading with a little more support.
        </div>
      </div>

      <div className="mt-5 grid gap-3 pb-6 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="card-surface px-4 py-4"
          >
            <div className="text-xl font-semibold text-slate-950">{item.item_text}</div>
            <div className="mt-2 text-sm leading-6 text-slate-700">
              {item.english_explanation || item.translated_explanation || "Meaning will appear soon."}
            </div>
            {item.translated_explanation &&
            item.translated_explanation !== item.english_explanation ? (
              <div className="mt-2 text-sm text-slate-500">{item.translated_explanation}</div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row">
        <button
          onClick={onDone}
          className="primary-button sm:flex-1"
        >
          Continue to Second Read
        </button>
      </div>
    </div>
  );
}
