"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import {
  getEffectiveVocabularyDefinition,
  getEffectiveVocabularyTranslation,
  hasContextGeneratedVocabularyOverride,
} from "@/services/vocabulary/vocabulary-item-overrides";

type VocabItem = {
  id: string;
  item_text: string;
  english_explanation?: string | null;
  translated_explanation?: string | null;
  example_text?: string | null;
  context_sentence?: string | null;
  audio_url?: string | null;
  canonical_lemma?: string | null;
  student_definition_override?: string | null;
  student_translation_override?: string | null;
  definition_override_generated_from_context?: boolean | null;
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
  onDeleteItem?: (item: VocabItem) => Promise<void> | void;
  onRegenerateItem?: (item: VocabItem) => Promise<VocabItem | void> | VocabItem | void;
  isAudioLoading?: boolean;
  title?: string;
  emptyTitle?: string;
  emptyCopy?: string;
  continueLabel?: string;
  backLabel?: string;
  embedded?: boolean;
};

type PendingAudioRequest = {
  textKey: string;
  lemmaKey: string;
};

function isPersistedVocabularyItemId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id
  );
}

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

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        d="M9.5 4.75h5a1 1 0 0 1 .94.66l.34 1.09H19a.75.75 0 1 1 0 1.5h-.86l-.74 10.01a2.25 2.25 0 0 1-2.24 2.09H8.84A2.25 2.25 0 0 1 6.6 18.01L5.86 8H5a.75.75 0 0 1 0-1.5h3.22l.34-1.09a1 1 0 0 1 .94-.66Zm.12 1.5-.08.25h4.92l-.08-.25H9.62ZM8.1 8l.73 9.88a.75.75 0 0 0 .75.7h5.84a.75.75 0 0 0 .75-.7L16.9 8H8.1Zm2.4 1.75a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0v-5.5a.75.75 0 0 1 .75-.75Zm3 0a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0v-5.5a.75.75 0 0 1 .75-.75Z"
        fill="currentColor"
      />
    </svg>
  );
}

function RegenerateIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        d="M12 5a7 7 0 1 1-6.3 9.95.75.75 0 0 1 1.35-.66A5.5 5.5 0 1 0 7.74 8H10a.75.75 0 0 1 0 1.5H5.75A.75.75 0 0 1 5 8.75V4.5a.75.75 0 0 1 1.5 0v2.23A6.97 6.97 0 0 1 12 5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function AudioIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
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
  );
}

function ActionButton(props: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "neutral" | "danger";
}) {
  const toneClass =
    props.tone === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-[var(--color-border)] bg-[var(--color-surface-muted)] token-text-secondary";

  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition hover:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${toneClass}`}
    >
      {props.icon}
      <span>{props.label}</span>
    </button>
  );
}

export default function VocabularyReviewCards({
  items,
  isHydrating = false,
  onVisibleItemsChange,
  onDone,
  onBackToReading,
  onRequestAudio,
  onDeleteItem,
  onRegenerateItem,
  isAudioLoading = false,
  title = "Saved from this passage",
  emptyTitle = "Nothing saved this time",
  emptyCopy = "Continue to the second read, or go back and save a few words first.",
  continueLabel = "Continue to Second Read",
  backLabel = "← Back to First Read",
  embedded = false,
}: Props) {
  const [pageIndex, setPageIndex] = useState(0);
  const [pendingAudioItem, setPendingAudioItem] = useState<PendingAudioRequest | null>(null);
  const [audioOverrides, setAudioOverrides] = useState<Record<string, string>>({});
  const [hiddenItemIds, setHiddenItemIds] = useState<string[]>([]);
  const [patchedItems, setPatchedItems] = useState<Record<string, Partial<VocabItem>>>({});
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [pendingRegenerateIds, setPendingRegenerateIds] = useState<string[]>([]);
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const detachedAudioRef = useRef<HTMLAudioElement | null>(null);
  const silentAudioUrlRef = useRef<string | null>(null);
  const playbackObjectUrlsRef = useRef<Set<string>>(new Set());
  const mediaUnlockedRef = useRef(false);
  const detachedMediaUnlockedRef = useRef(false);
  const CARDS_PER_PAGE = 6;
  const itemIdSignature = useMemo(() => items.map((item) => item.id).join("|"), [items]);

  useEffect(() => {
    setHiddenItemIds((current) => current.filter((id) => items.some((item) => item.id === id)));
    setPatchedItems((current) => {
      const nextEntries = Object.entries(current).filter(([id]) =>
        items.some((item) => item.id === id)
      );
      return nextEntries.length === Object.keys(current).length
        ? current
        : Object.fromEntries(nextEntries);
    });
    setActionErrors((current) => {
      const nextEntries = Object.entries(current).filter(([id]) =>
        items.some((item) => item.id === id)
      );
      return nextEntries.length === Object.keys(current).length
        ? current
        : Object.fromEntries(nextEntries);
    });
  }, [itemIdSignature, items]);

  const effectiveItems = useMemo(
    () =>
      items
        .map((item) => ({
          ...item,
          ...(patchedItems[item.id] ?? {}),
        }))
        .filter((item) => !hiddenItemIds.includes(item.id)),
    [hiddenItemIds, items, patchedItems]
  );

  const itemsResetSignature = useMemo(
    () => effectiveItems.map((item) => item.id).join("|"),
    [effectiveItems]
  );
  const totalPages = Math.max(1, Math.ceil(effectiveItems.length / CARDS_PER_PAGE));

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

      for (const objectUrl of playbackObjectUrlsRef.current) {
        URL.revokeObjectURL(objectUrl);
      }
      playbackObjectUrlsRef.current.clear();
    };
  }, []);

  const visibleItems = useMemo(() => {
    const start = pageIndex * CARDS_PER_PAGE;
    return effectiveItems.slice(start, start + CARDS_PER_PAGE);
  }, [effectiveItems, pageIndex]);

  useEffect(() => {
    onVisibleItemsChange?.(visibleItems);
  }, [onVisibleItemsChange, visibleItems]);

  useEffect(() => {
    if (!pendingAudioItem) {
      return;
    }

    const resolvedItem = effectiveItems.find(
      (item) =>
        item.audio_url &&
        (getAudioItemKey(item.item_text) === pendingAudioItem.textKey ||
          getAudioLemmaKey(item) === pendingAudioItem.lemmaKey)
    );
    const resolvedAudioUrl =
      resolvedItem?.audio_url || audioOverrides[pendingAudioItem.textKey] || null;

    if (!resolvedAudioUrl) {
      return;
    }

    void playAudio(resolvedAudioUrl).finally(() => {
      setPendingAudioItem(null);
    });
  }, [audioOverrides, effectiveItems, pendingAudioItem]);

  async function createPlaybackUrl(url: string) {
    if (!url.startsWith("data:audio/")) {
      return { playbackUrl: url, revokeAfterPlayback: false };
    }

    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      playbackObjectUrlsRef.current.add(objectUrl);
      return { playbackUrl: objectUrl, revokeAfterPlayback: true };
    } catch (error) {
      console.error("VocabularyReviewCards createPlaybackUrl error", error);
      return { playbackUrl: url, revokeAfterPlayback: false };
    }
  }

  async function playAudio(url: string, audioElement: HTMLAudioElement | null = audioRef.current) {
    if (!audioElement) {
      return;
    }

    if (audioElement !== audioRef.current && audioRef.current) {
      audioRef.current.pause();
    }

    if (audioElement !== detachedAudioRef.current && detachedAudioRef.current) {
      detachedAudioRef.current.pause();
    }

    const { playbackUrl, revokeAfterPlayback } = await createPlaybackUrl(url);

    audioElement.pause();
    audioElement.src = playbackUrl;
    audioElement.currentTime = 0;

    try {
      await audioElement.play();
    } catch (error) {
      console.error("VocabularyReviewCards playAudio error", error);
    } finally {
      if (revokeAfterPlayback) {
        const cleanup = () => {
          if (playbackObjectUrlsRef.current.has(playbackUrl)) {
            URL.revokeObjectURL(playbackUrl);
            playbackObjectUrlsRef.current.delete(playbackUrl);
          }
          audioElement.removeEventListener("ended", cleanup);
          audioElement.removeEventListener("error", cleanup);
        };

        audioElement.addEventListener("ended", cleanup, { once: true });
        audioElement.addEventListener("error", cleanup, { once: true });
      }
    }
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
    const itemLemmaKey = getAudioLemmaKey(item);
    const immediateAudioUrl = item.audio_url || audioOverrides[itemKey];

    if (immediateAudioUrl) {
      void playAudio(immediateAudioUrl);
      return;
    }

    if (!onRequestAudio) {
      return;
    }

    setPendingAudioItem({
      textKey: itemKey,
      lemmaKey: itemLemmaKey,
    });

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
        await playAudio(matchingResponseItem.audio_url, detachedAudioRef.current);
        setPendingAudioItem(null);
      }
    } catch (error) {
      console.error("VocabularyReviewCards requestAudio error", error);
      setPendingAudioItem(null);
    }
  }

  async function handleDeletePress(item: VocabItem) {
    if (!onDeleteItem || pendingDeleteIds.includes(item.id)) {
      return;
    }

    setActionErrors((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });
    setPendingDeleteIds((current) => [...current, item.id]);
    setHiddenItemIds((current) => (current.includes(item.id) ? current : [...current, item.id]));

    try {
      await onDeleteItem(item);
    } catch (error) {
      setHiddenItemIds((current) => current.filter((id) => id !== item.id));
      setActionErrors((current) => ({
        ...current,
        [item.id]: error instanceof Error ? error.message : "Delete failed",
      }));
    } finally {
      setPendingDeleteIds((current) => current.filter((id) => id !== item.id));
    }
  }

  async function handleRegeneratePress(item: VocabItem) {
    if (!onRegenerateItem || pendingRegenerateIds.includes(item.id)) {
      return;
    }

    setActionErrors((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });
    setPendingRegenerateIds((current) => [...current, item.id]);

    try {
      const nextItem = await onRegenerateItem(item);
      if (nextItem) {
        setPatchedItems((current) => ({
          ...current,
          [item.id]: nextItem,
        }));
      }
    } catch (error) {
      setActionErrors((current) => ({
        ...current,
        [item.id]: error instanceof Error ? error.message : "Regeneration failed",
      }));
    } finally {
      setPendingRegenerateIds((current) => current.filter((id) => id !== item.id));
    }
  }

  const showFooterActions = Boolean(onDone || onBackToReading);
  const containerClassName = embedded
    ? "mx-auto flex w-full max-w-3xl flex-col px-0 py-0"
    : "mx-auto flex min-h-[calc(100svh-12rem)] max-w-3xl flex-col px-4 py-4 sm:px-6";

  if (!effectiveItems.length) {
    return (
      <div className={containerClassName}>
        <audio ref={audioRef} hidden playsInline preload="none" />
        <div className="card-surface space-y-3 px-6 py-8 text-center">
          <div className="text-2xl font-semibold token-text-primary">{emptyTitle}</div>
          <div className="token-text-secondary text-sm leading-6">{emptyCopy}</div>
        </div>
        {!embedded && showFooterActions ? (
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            {onBackToReading ? (
              <button
                onClick={onBackToReading}
                className="app-button app-button-muted sm:flex-1"
              >
                {backLabel}
              </button>
            ) : null}
            {onDone ? (
              <button onClick={onDone} className="primary-button sm:flex-1">
                {continueLabel}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={containerClassName}>
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
        {visibleItems.map((item) => {
          const itemKey = getAudioItemKey(item.item_text);
          const effectiveDefinition = getEffectiveVocabularyDefinition(item);
          const effectiveTranslation = getEffectiveVocabularyTranslation(item);
          const canRegenerateItem = Boolean(onRegenerateItem) && isPersistedVocabularyItemId(item.id);
          const isDeleting = pendingDeleteIds.includes(item.id);
          const isRegenerating = pendingRegenerateIds.includes(item.id);
          const isPendingThisAudioItem =
            pendingAudioItem?.textKey === itemKey ||
            pendingAudioItem?.lemmaKey === getAudioLemmaKey(item);
          const resolvedAudioUrl = item.audio_url || audioOverrides[itemKey] || null;
          const isLoadingThisAudioItem =
            isPendingThisAudioItem && isAudioLoading && !resolvedAudioUrl;

          return (
            <div key={item.id} className="card-surface flex flex-col gap-3 px-4 py-4">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="token-text-primary text-xl font-semibold">{item.item_text}</div>
                    {hasContextGeneratedVocabularyOverride(item) ? (
                      <div className="mt-1 inline-flex rounded-full border border-[var(--color-secondary)]/20 bg-[var(--color-secondary-soft)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-secondary)]">
                        Context meaning
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="token-text-secondary text-sm leading-6">
                  {effectiveDefinition || effectiveTranslation || "Meaning will appear soon."}
                </div>
                {effectiveTranslation && effectiveTranslation !== effectiveDefinition ? (
                  <div className="token-text-muted text-sm leading-6">{effectiveTranslation}</div>
                ) : null}
              </div>

              {actionErrors[item.id] ? (
                <div className="text-xs font-medium text-rose-600">{actionErrors[item.id]}</div>
              ) : null}

              <div className="flex flex-wrap gap-2 pt-1">
                <ActionButton
                  label={isDeleting ? "Deleting..." : "Delete"}
                  icon={isDeleting ? <span className="h-3 w-3 animate-pulse rounded-full bg-current/70" /> : <DeleteIcon />}
                  onClick={() => void handleDeletePress(item)}
                  disabled={!onDeleteItem || isDeleting || isRegenerating}
                  tone="danger"
                />
                <ActionButton
                  label={isRegenerating ? "Updating..." : "Regenerate"}
                  icon={
                    isRegenerating ? (
                      <span className="h-3 w-3 animate-pulse rounded-full bg-current/70" />
                    ) : (
                      <RegenerateIcon />
                    )
                  }
                  onClick={() => void handleRegeneratePress(item)}
                  disabled={!canRegenerateItem || isRegenerating || isDeleting}
                />
                <ActionButton
                  label={isLoadingThisAudioItem ? "Loading..." : "Audio"}
                  icon={
                    isLoadingThisAudioItem ? (
                      <span className="h-3 w-3 animate-pulse rounded-full bg-current/70" />
                    ) : (
                      <AudioIcon />
                    )
                  }
                  onClick={() => void handleAudioPress(item)}
                  disabled={isLoadingThisAudioItem || (!resolvedAudioUrl && !onRequestAudio)}
                />
              </div>
            </div>
          );
        })}
      </div>

      {(totalPages > 1 || (!embedded && showFooterActions)) ? (
        <div className={`${embedded ? "" : "mt-auto "}flex flex-col gap-3 ${embedded ? "" : "border-t border-[var(--color-border)] pt-4"}`}>
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

          {!embedded && showFooterActions ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              {onBackToReading ? (
                <button onClick={onBackToReading} className="app-button app-button-muted sm:flex-1">
                  {backLabel}
                </button>
              ) : null}
              {onDone ? (
                <button onClick={onDone} className="primary-button sm:flex-1">
                  {continueLabel}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
