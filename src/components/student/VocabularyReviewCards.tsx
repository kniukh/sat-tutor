"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  isHydrating?: boolean;
  onVisibleItemsChange?: (items: VocabItem[]) => void;
  onDone?: () => void;
  onBackToReading?: () => void;
  onRequestAudio?: () => Promise<void> | void;
  isAudioLoading?: boolean;
};

export default function VocabularyReviewCards({
  items,
  isHydrating = false,
  onVisibleItemsChange,
  onDone,
  onBackToReading,
  onRequestAudio,
  isAudioLoading = false,
}: Props) {
  const [pageIndex, setPageIndex] = useState(0);
  const [pendingAudioItemId, setPendingAudioItemId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const CARDS_PER_PAGE = 6;

  useEffect(() => {
    setPageIndex(0);
  }, [items]);

  const totalPages = Math.max(1, Math.ceil(items.length / CARDS_PER_PAGE));
  const visibleItems = useMemo(() => {
    const start = pageIndex * CARDS_PER_PAGE;
    return items.slice(start, start + CARDS_PER_PAGE);
  }, [items, pageIndex]);

  useEffect(() => {
    onVisibleItemsChange?.(visibleItems);
  }, [onVisibleItemsChange, visibleItems]);

  useEffect(() => {
    if (!pendingAudioItemId) {
      return;
    }

    const resolvedItem = items.find(
      (item) => item.id === pendingAudioItemId && item.audio_url
    );

    if (!resolvedItem?.audio_url || !audioRef.current) {
      return;
    }

    audioRef.current.pause();
    audioRef.current.src = resolvedItem.audio_url;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch((error) => {
      console.error("VocabularyReviewCards playAudio error", error);
    });
    setPendingAudioItemId(null);
  }, [items, pendingAudioItemId]);

  function playAudio(url: string) {
    if (!audioRef.current) {
      return;
    }

    audioRef.current.pause();
    audioRef.current.src = url;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch((error) => {
      console.error("VocabularyReviewCards playAudio error", error);
    });
  }

  async function handleAudioPress(item: VocabItem) {
    if (item.audio_url) {
      playAudio(item.audio_url);
      return;
    }

    if (!onRequestAudio) {
      return;
    }

    setPendingAudioItemId(item.id);

    try {
      await onRequestAudio();
    } catch (error) {
      console.error("VocabularyReviewCards requestAudio error", error);
      setPendingAudioItemId(null);
    }
  }

  if (!items.length) {
    return (
      <div className="mx-auto flex min-h-[calc(100svh-12rem)] max-w-3xl flex-col justify-center px-4 py-8 text-center sm:px-6">
        <audio ref={audioRef} hidden />
        <div className="card-surface space-y-3 px-6 py-8">
          <div className="text-2xl font-semibold token-text-primary">Nothing saved this time</div>
          <div className="token-text-secondary text-sm leading-6">
            Continue to the second read, or go back and save a few words first.
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          {onBackToReading ? (
            <button
              onClick={onBackToReading}
              className="app-button app-button-muted sm:flex-1"
            >
              ← Back to First Read
            </button>
          ) : null}
          <button
            onClick={onDone}
            className="primary-button sm:flex-1"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100svh-12rem)] max-w-3xl flex-col px-4 py-4 sm:px-6">
      <audio ref={audioRef} hidden />
      <div className="space-y-1">
        <h2 className="token-text-primary text-2xl font-semibold">Saved from this passage</h2>
        {totalPages > 1 ? (
          <div className="token-text-muted text-sm leading-6">
            {`Page ${pageIndex + 1} of ${totalPages}`}
          </div>
        ) : null}
        {isHydrating ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-1.5 text-sm token-text-secondary">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--color-secondary)]" />
            <span>Updating meanings...</span>
          </div>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 pb-6 sm:grid-cols-2">
        {visibleItems.map((item) => (
          <div
            key={item.id}
            className="card-surface px-4 py-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="token-text-primary text-xl font-semibold">{item.item_text}</div>
              <button
                type="button"
                onClick={() => void handleAudioPress(item)}
                disabled={isAudioLoading}
                className="secondary-button min-h-9 shrink-0 px-3 py-1.5 text-xs disabled:opacity-50"
              >
                {item.audio_url ? "Play" : isAudioLoading ? "Loading..." : "Load audio"}
              </button>
            </div>
            <div className="token-text-secondary mt-2 text-sm leading-6">
              {item.english_explanation || item.translated_explanation || "Meaning will appear soon."}
            </div>
            {item.translated_explanation &&
            item.translated_explanation !== item.english_explanation ? (
              <div className="token-text-muted mt-2 text-sm">{item.translated_explanation}</div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-3 border-t border-[var(--color-border)] pt-4">
        {totalPages > 1 ? (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
              disabled={pageIndex === 0}
              className="secondary-button min-h-12 flex-1 disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() =>
                setPageIndex((current) => Math.min(totalPages - 1, current + 1))
              }
              disabled={pageIndex >= totalPages - 1}
              className="secondary-button min-h-12 flex-1 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          {onBackToReading ? (
            <button
              onClick={onBackToReading}
              className="app-button app-button-muted sm:flex-1"
            >
              ← Back to First Read
            </button>
          ) : null}
          <button
            onClick={onDone}
            className="primary-button sm:flex-1"
          >
            Continue to Second Read
          </button>
        </div>
      </div>
    </div>
  );
}
