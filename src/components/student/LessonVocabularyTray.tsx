"use client";

import type { CapturedVocabularyItem } from "./PassageVocabularyCapture";

type Props = {
  items: CapturedVocabularyItem[];
  onRemove: (itemText: string) => void;
  onClear?: () => void;
};

export default function LessonVocabularyTray({ items, onRemove, onClear }: Props) {
  if (items.length === 0) {
    return null;
  }

  const pendingCount = items.filter((item) => item.saveState !== "saved").length;
  const savedCount = items.length - pendingCount;

  return (
    <details className="pointer-events-none fixed bottom-28 right-4 z-40 w-[min(22rem,calc(100vw-1.5rem))] sm:bottom-32 sm:right-6">
      <summary className="pointer-events-auto flex cursor-pointer list-none justify-end marker:content-none">
        <span className="surface-soft-panel inline-flex h-16 w-16 items-center justify-center rounded-full border border-[var(--color-border)] text-lg font-semibold token-text-primary shadow-[0_14px_32px_rgba(15,23,42,0.18)] backdrop-blur transition hover:scale-[0.98]">
          W
        </span>
      </summary>

      <div className="pointer-events-auto mt-3 overflow-hidden rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface)]/96 p-4 shadow-[0_22px_48px_rgba(15,23,42,0.22)] backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="token-text-primary text-sm font-semibold">Word Bank</div>
            <div className="token-text-muted mt-1 text-xs leading-5">
              {pendingCount > 0 ? `${pendingCount} pending` : "All saved"}
              {savedCount > 0 ? ` • ${savedCount} saved` : ""}
              {" • "}Auto-saves at checkpoints.
            </div>
          </div>
          {onClear && pendingCount > 0 ? (
            <button
              type="button"
              onClick={onClear}
              className="secondary-button min-h-9 px-3 py-1.5 text-xs"
            >
              Clear Pending
            </button>
          ) : null}
        </div>

        <div className="mt-3 flex max-h-40 flex-wrap gap-2 overflow-y-auto pr-1">
          {items.map((item) => (
            <div
              key={`${item.sourceType}:${item.itemText}`}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${
                item.saveState === "saved"
                  ? "border-emerald-300/60 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200"
                  : "border-[var(--color-secondary)] bg-[var(--color-secondary-soft)] text-[var(--color-secondary)]"
              }`}
            >
              <span className="max-w-[11rem] truncate">{item.itemText}</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-80">
                {item.saveState === "saved" ? "Saved" : "Pending"}
              </span>
              {item.saveState !== "saved" ? (
                <button
                  type="button"
                  onClick={() => onRemove(item.itemText)}
                  className="text-xs leading-none opacity-80 transition hover:opacity-100"
                  aria-label={`Remove ${item.itemText}`}
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
