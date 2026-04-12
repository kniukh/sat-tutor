"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";

type VocabItem = {
  id: string;
  item_text: string;
  english_explanation?: string | null;
  translated_explanation?: string | null;
  example_text?: string | null;
  context_sentence?: string | null;
  audio_url?: string | null;
  canonical_lemma?: string | null;
};

type Props = {
  items: VocabItem[];
  isHydrating?: boolean;
  onVisibleItemsChange?: (items: VocabItem[]) => void;
  onDone?: () => void;
  onBackToReading?: () => void;
  onRequestAudio?: (options?: {
    force?: boolean;
    itemTexts?: string[];
  }) => Promise<VocabItem[] | void> | VocabItem[] | void;
  isAudioLoading?: boolean;
  title?: string;
  emptyTitle?: string;
  emptyCopy?: string;
  continueLabel?: string;
  backLabel?: string;
};

function getAudioItemKey(itemText: string) {
  return itemText.trim().toLowerCase();
}

function getAudioLemmaKey(item: Pick<VocabItem, "item_text" | "canonical_lemma">) {
  return item.canonical_lemma?.trim().toLowerCase() || getAudioItemKey(item.item_text);
}

function createSilentWavUrl() {
  const wavBytes = new Uint8Array([
    82, 73, 70, 70, 38, 0, 0, 0, 87, 65, 86, 69, 102, 109, 116, 32,
    16, 0, 0, 0, 1, 0, 1, 0, 64, 31, 0, 0, 128, 62, 0, 0,
    2, 0, 16, 0, 100, 97, 116, 97, 2, 0, 0, 0, 0, 0,
  ]);

  return URL.createObjectURL(new Blob([wavBytes], { type: "audio/wav" }));
}

export default function VocabularyReviewCards({
  items,
  isHydrating = false,
  onVisibleItemsChange,
  onDone,
  onBackToReading,
  onRequestAudio,
  isAudioLoading = false,
  title = "Saved from this passage",
  emptyTitle = "Nothing saved this time",
  emptyCopy = "Continue to the second read, or go back and save a few words first.",
  continueLabel = "Continue to Second Read",
  backLabel = "← Back to First Read",
}: Props) {
  const [pageIndex, setPageIndex] = useState(0);
  const [pendingAudioItemKey, setPendingAudioItemKey] = useState<string | null>(null);
  const [audioOverrides, setAudioOverrides] = useState<Record<string, string>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const detachedAudioRef = useRef<HTMLAudioElement | null>(null);
  const silentAudioUrlRef = useRef<string | null>(null);
  const mediaUnlockedRef = useRef(false);
  const detachedMediaUnlockedRef = useRef(false);
  const CARDS_PER_PAGE = 6;
  const itemsResetSignature = useMemo(
    () => items.map((item) => getAudioItemKey(item.item_text)).join("|"),
    [items]
  );

  const totalPages = Math.max(1, Math.ceil(items.length / CARDS_PER_PAGE));

  useEffect(() => {
    setPageIndex(0);
  }, [itemsResetSignature]);

  useEffect(() => {
    setPageIndex((current) => Math.min(current, totalPages - 1));
  }, [totalPages]);

  useEffect(() => {
    return () => {
      if (detachedAudioRef.current) {
        detachedAudioRef.current.pause();
        detachedAudioRef.current.removeAttribute("src");
        detachedAudioRef.current.load();
        detachedAudioRef.current = null;
      }

      if (silentAudioUrlRef.current) {
        URL.revokeObjectURL(silentAudioUrlRef.current);
        silentAudioUrlRef.current = null;
      }
    };
  }, []);

  const visibleItems = useMemo(() => {
    const start = pageIndex * CARDS_PER_PAGE;
    return items.slice(start, start + CARDS_PER_PAGE);
  }, [items, pageIndex]);

  useEffect(() => {
    onVisibleItemsChange?.(visibleItems);
  }, [onVisibleItemsChange, visibleItems]);

  useEffect(() => {
    if (!pendingAudioItemKey) {
      return;
    }

    const resolvedItem = items.find(
      (item) =>
        getAudioItemKey(item.item_text) === pendingAudioItemKey && item.audio_url
    );
    const resolvedAudioUrl =
      resolvedItem?.audio_url || audioOverrides[pendingAudioItemKey] || null;

    if (!resolvedAudioUrl || !audioRef.current) {
      return;
    }

    audioRef.current.pause();
    audioRef.current.src = resolvedAudioUrl;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch((error) => {
      console.error("VocabularyReviewCards playAudio error", error);
    });
    setPendingAudioItemKey(null);
  }, [audioOverrides, items, pendingAudioItemKey]);

  function playAudio(url: string, audioElement: HTMLAudioElement | null = audioRef.current) {
    if (!audioElement) {
      return;
    }

    if (audioElement !== audioRef.current && audioRef.current) {
      audioRef.current.pause();
    }

    if (audioElement !== detachedAudioRef.current && detachedAudioRef.current) {
      detachedAudioRef.current.pause();
    }

    audioElement.pause();
    audioElement.src = url;
    audioElement.currentTime = 0;
    audioElement.play().catch((error) => {
      console.error("VocabularyReviewCards playAudio error", error);
    });
  }

  async function ensureMediaPlaybackUnlockedForElement(
    audio: HTMLAudioElement | null,
    unlockedRef: MutableRefObject<boolean>
  ) {
    if (unlockedRef.current || !audio) {
      return;
    }

    if (!silentAudioUrlRef.current) {
      silentAudioUrlRef.current = createSilentWavUrl();
    }

    const previousSrc = audio.currentSrc || audio.src;
    const previousMuted = audio.muted;
    const previousVolume = audio.volume;

    try {
      audio.pause();
      audio.muted = true;
      audio.volume = 0;
      audio.src = silentAudioUrlRef.current;
      audio.currentTime = 0;
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      unlockedRef.current = true;
    } catch (error) {
      console.error("VocabularyReviewCards media unlock error", error);
    } finally {
      audio.muted = previousMuted;
      audio.volume = previousVolume;

      if (previousSrc) {
        audio.src = previousSrc;
      } else {
        audio.removeAttribute("src");
      }

      audio.load();
    }
  }

  async function ensureSharedMediaPlaybackUnlocked() {
    await ensureMediaPlaybackUnlockedForElement(audioRef.current, mediaUnlockedRef);
  }

  async function handleAudioPress(item: VocabItem) {
    const itemKey = getAudioItemKey(item.item_text);
    const immediateAudioUrl = item.audio_url || audioOverrides[itemKey];

    if (immediateAudioUrl) {
      playAudio(immediateAudioUrl);
      return;
    }

    if (!onRequestAudio) {
      return;
    }

    setPendingAudioItemKey(itemKey);

    try {
      const detachedAudio = new Audio();
      detachedAudio.preload = "none";
      detachedAudio.setAttribute("playsinline", "true");
      detachedAudioRef.current = detachedAudio;
      detachedMediaUnlockedRef.current = false;

      await Promise.all([
        ensureSharedMediaPlaybackUnlocked(),
        ensureMediaPlaybackUnlockedForElement(detachedAudio, detachedMediaUnlockedRef),
      ]);

      const responseItems = await onRequestAudio({
        force: true,
        itemTexts: [item.item_text],
      });

      const matchingResponseItem = Array.isArray(responseItems)
        ? responseItems.find((candidate) => {
            const candidateTextKey = getAudioItemKey(candidate.item_text);
            const candidateLemmaKey = getAudioLemmaKey(candidate);
            return (
              candidateTextKey === getAudioItemKey(item.item_text) ||
              candidateLemmaKey === getAudioLemmaKey(item)
            );
          })
        : null;

      if (matchingResponseItem?.audio_url) {
        setAudioOverrides((current) => ({
          ...current,
          [itemKey]: matchingResponseItem.audio_url as string,
        }));
        playAudio(matchingResponseItem.audio_url, detachedAudioRef.current);
        setPendingAudioItemKey(null);
      }
    } catch (error) {
      console.error("VocabularyReviewCards requestAudio error", error);
      setPendingAudioItemKey(null);
    }
  }

  function renderSpeakerButton(item: VocabItem) {
    const itemKey = getAudioItemKey(item.item_text);
    const isPendingThisItem =
      pendingAudioItemKey === itemKey;
    const resolvedAudioUrl = item.audio_url || audioOverrides[itemKey] || null;
    const isLoadingThisItem = isPendingThisItem && isAudioLoading && !resolvedAudioUrl;
    const isDisabled = isLoadingThisItem || (!resolvedAudioUrl && !onRequestAudio);

    return (
      <button
        type="button"
        onClick={() => void handleAudioPress(item)}
        disabled={isDisabled}
        aria-label={
          resolvedAudioUrl
            ? `Play audio for ${item.item_text}`
            : `Load and play audio for ${item.item_text}`
        }
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-primary)] transition hover:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
      >
        {isLoadingThisItem ? (
          <span className="h-4 w-4 animate-pulse rounded-full bg-[var(--color-primary)]/70" />
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
            <path
              d="M11 5.5 7.75 8H5.5A1.5 1.5 0 0 0 4 9.5v5A1.5 1.5 0 0 0 5.5 16h2.25L11 18.5a.75.75 0 0 0 1.2-.6V6.1a.75.75 0 0 0-1.2-.6Z"
              fill="currentColor"
            />
            <path
              d="M15.5 8.75a4.5 4.5 0 0 1 0 6.5M17.75 6.5a7.5 7.5 0 0 1 0 11"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.8"
            />
          </svg>
        )}
      </button>
    );
  }

  if (!items.length) {
    return (
      <div className="mx-auto flex min-h-[calc(100svh-12rem)] max-w-3xl flex-col justify-center px-4 py-8 text-center sm:px-6">
        <audio ref={audioRef} hidden playsInline preload="none" />
        <div className="card-surface space-y-3 px-6 py-8">
          <div className="text-2xl font-semibold token-text-primary">{emptyTitle}</div>
          <div className="token-text-secondary text-sm leading-6">
            {emptyCopy}
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          {onBackToReading ? (
            <button
              onClick={onBackToReading}
              className="app-button app-button-muted sm:flex-1"
            >
              {backLabel}
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
      <audio ref={audioRef} hidden playsInline preload="none" />
      <div className="space-y-1">
        <h2 className="token-text-primary text-2xl font-semibold">{title}</h2>
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
              {renderSpeakerButton(item)}
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
              {backLabel}
            </button>
          ) : null}
          <button
            onClick={onDone}
            className="primary-button sm:flex-1"
          >
            {continueLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
