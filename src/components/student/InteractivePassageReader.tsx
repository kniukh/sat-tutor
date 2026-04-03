"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildInlinePreviewCacheKey,
  getCachedInlinePreview,
  setCachedInlinePreview,
} from "@/services/vocabulary/inline-preview-cache.client";
import type { CapturedVocabularyItem } from "./PassageVocabularyCapture";

type KnownWord = {
  id: string;
  item_text: string;
  english_explanation?: string | null;
  translated_explanation?: string | null;
  context_sentence?: string | null;
  audio_url?: string | null;
  lifecycle_state?: string | null;
  review_bucket?:
    | "recently_failed"
    | "weak_again"
    | "overdue"
    | "reinforcement"
    | "scheduled"
    | null;
  review_ready?: boolean;
};

type Props = {
  studentId: string;
  lessonId: string;
  passageId?: string;
  passageText: string;
  highlightText?: string | null;
  knownWords?: KnownWord[];
  onCaptured?: (item: CapturedVocabularyItem) => void;
  mode?: "capture" | "review" | "audio_review" | "reference";
};

type HoverCardState = {
  x: number;
  y: number;
  item: KnownWord;
  pinned?: boolean;
} | null;

type InlinePreview = {
  item_text: string;
  item_type: "word" | "phrase";
  plain_english_meaning: string;
  translation: string;
  context_meaning: string;
};

function hasUsefulInlinePreview(preview: InlinePreview | null | undefined) {
  const meaning = preview?.plain_english_meaning?.trim() ?? "";
  return Boolean(meaning) && meaning !== "Quick preview not ready yet.";
}

type SelectionPopupState = {
  x: number;
  y: number;
  itemText: string;
  itemType: "word" | "phrase";
} | null;

type TouchPoint = {
  clientX: number;
  clientY: number;
};

function normalizeWord(word: string) {
  return word
    .toLowerCase()
    .replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, "")
    .trim();
}

function getWordCandidates(word: string) {
  const normalized = normalizeWord(word);
  if (!normalized) return [];

  const candidates = new Set<string>();
  candidates.add(normalized);

  if (normalized.endsWith("s") && normalized.length > 3) {
    candidates.add(normalized.slice(0, -1));
  }

  if (normalized.endsWith("es") && normalized.length > 4) {
    candidates.add(normalized.slice(0, -2));
  }

  if (normalized.endsWith("ed") && normalized.length > 4) {
    candidates.add(normalized.slice(0, -2));
  }

  if (normalized.endsWith("ing") && normalized.length > 5) {
    candidates.add(normalized.slice(0, -3));
  }

  return Array.from(candidates);
}

function buildSnippet(fullText: string, itemText: string) {
  const lowerText = fullText.toLowerCase();
  const lowerItem = itemText.toLowerCase();
  const index = lowerText.indexOf(lowerItem);

  if (index === -1) {
    return null;
  }

  const start = Math.max(0, index - 28);
  const end = Math.min(fullText.length, index + itemText.length + 28);
  return fullText.slice(start, end).replace(/\s+/g, " ").trim();
}

function normalizePassageDisplayText(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/([^\n])\n(?=[^\n])/g, "$1 ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getKnownWordTokenClass(item: KnownWord, mode: Props["mode"]) {
  if (item.review_ready || item.review_bucket === "weak_again") {
    return "reading-known-word reading-known-word--review-ready";
  }

  if (item.review_bucket === "recently_failed") {
    return "reading-known-word reading-known-word--recently-failed";
  }

  if (mode === "audio_review") {
    return "reading-known-word reading-known-word--audio";
  }

  return "reading-known-word reading-known-word--known";
}

function clampPopupPosition(x: number, y: number) {
  if (typeof window === "undefined") {
    return { x, y };
  }

  const maxX = Math.max(16, window.innerWidth - 180);
  const minY = 16;
  const maxY = Math.max(16, window.innerHeight - 90);

  return {
    x: Math.min(Math.max(16, x), maxX),
    y: Math.min(Math.max(minY, y), maxY),
  };
}

function clampCardPosition(x: number, y: number) {
  if (typeof window === "undefined") {
    return { x, y };
  }

  const cardWidth = Math.min(320, window.innerWidth - 24);
  const cardHeight = 260;
  const maxX = Math.max(12, window.innerWidth - cardWidth - 12);
  const maxY = Math.max(12, window.innerHeight - cardHeight - 12);

  return {
    x: Math.min(Math.max(12, x), maxX),
    y: Math.min(Math.max(12, y), maxY),
  };
}

function findHighlightRange(passageText: string, highlightText: string | null | undefined) {
  const snippet = highlightText?.trim();

  if (!snippet) {
    return null;
  }

  const start = passageText.toLowerCase().indexOf(snippet.toLowerCase());

  if (start === -1) {
    return null;
  }

  return {
    start,
    end: start + snippet.length,
  };
}

export default function InteractivePassageReader({
  studentId,
  lessonId,
  passageId,
  passageText,
  highlightText,
  knownWords = [],
  onCaptured,
  mode = "reference",
}: Props) {
  const [selectionPopup, setSelectionPopup] = useState<SelectionPopupState>(null);
  const [preview, setPreview] = useState<InlinePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hoverCard, setHoverCard] = useState<HoverCardState>(null);
  const [captureToast, setCaptureToast] = useState<string | null>(null);
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayPassageText = useMemo(
    () => normalizePassageDisplayText(passageText),
    [passageText]
  );

  const knownWordsMap = useMemo(() => {
    const map = new Map<string, KnownWord>();
    for (const item of knownWords) {
      const key = normalizeWord(item.item_text.trim());
      if (!key) continue;
      if (!map.has(key)) map.set(key, item);
    }
    return map;
  }, [knownWords]);
  const highlightRange = useMemo(
    () => findHighlightRange(displayPassageText, highlightText),
    [displayPassageText, highlightText]
  );

  function handleMouseUp() {
    if (mode !== "capture" && mode !== "audio_review") {
      return;
    }

    const sel = window.getSelection();
    const text = sel?.toString()?.trim() ?? "";

    if (!text) {
      setSelectionPopup(null);
      return;
    }

    const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
    const rect = range?.getBoundingClientRect();

    if (rect) {
      const position = clampPopupPosition(
        rect.left + rect.width / 2 - 76,
        rect.top - 52
      );
      setSelectionPopup({
        x: position.x,
        y: position.y,
        itemText: text,
        itemType: text.includes(" ") ? "phrase" : "word",
      });
    }
  }

  useEffect(() => {
    if (!selectionPopup) {
      setPreview(null);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    const itemText = selectionPopup.itemText.trim();
    if (!itemText) {
      setPreview(null);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    const localMatch = knownWordsMap.get(normalizeWord(itemText));
    if (localMatch) {
      setPreview({
        item_text: localMatch.item_text,
        item_type: itemText.includes(" ") ? "phrase" : "word",
        plain_english_meaning:
          localMatch.english_explanation?.trim() || "Meaning available in review.",
        translation: localMatch.translated_explanation?.trim() || "",
        context_meaning:
          localMatch.context_sentence?.trim() ||
          localMatch.english_explanation?.trim() ||
          "Meaning available in this passage.",
      });
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    if (!passageId) {
      setPreview(null);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    let cancelled = false;
    const cacheKey = buildInlinePreviewCacheKey({
      studentId,
      lessonId,
      itemText,
      sourceText: displayPassageText,
    });
    const cachedPreview = getCachedInlinePreview(cacheKey);

    if (cachedPreview) {
      setPreview(cachedPreview);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    async function loadPreview() {
      setPreview(null);
      setPreviewError(null);
      setPreviewLoading(true);

      try {
        const response = await fetch("/api/vocabulary/preview-inline", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            studentId,
            lessonId,
            passageId,
            itemText,
          }),
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.error ?? "Preview unavailable");
        }

        if (!cancelled) {
          if (payload?.data) {
            setCachedInlinePreview(cacheKey, payload.data);
          }
          setPreview(payload?.data ?? null);
        }
      } catch (error) {
        if (!cancelled) {
          setPreviewError(error instanceof Error ? error.message : "Preview unavailable");
        }
      } finally {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [selectionPopup, knownWordsMap, studentId, lessonId, passageId, displayPassageText]);

  function queueCapturedItem(itemText: string) {
    onCaptured?.({
      itemText,
      itemType: itemText.includes(" ") ? "phrase" : "word",
      sourceType: "passage",
      contextText: buildSnippet(displayPassageText, itemText),
      preview: preview
        ? {
            plainEnglishMeaning: preview.plain_english_meaning,
            translation: preview.translation,
            contextMeaning: preview.context_meaning,
          }
        : null,
    });
    setCaptureToast(itemText);
    window.setTimeout(() => {
      setCaptureToast((current) => (current === itemText ? null : current));
    }, 1600);
  }

  async function resolvePreviewForCapture(itemText: string) {
    if (hasUsefulInlinePreview(preview)) {
      return preview;
    }

    if (!passageId) {
      return null;
    }

    try {
      const response = await fetch("/api/vocabulary/preview-inline", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId,
          lessonId,
          passageId,
          itemText,
          sourceText: buildSnippet(displayPassageText, itemText) ?? displayPassageText,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Preview unavailable");
      }

      const resolvedPreview = payload?.data as InlinePreview | undefined;

      if (resolvedPreview) {
        setPreview(resolvedPreview);
        setPreviewError(null);
        setPreviewLoading(false);
      }

      return resolvedPreview ?? null;
    } catch (error) {
      console.error("resolvePreviewForCapture error", error);
      return null;
    }
  }

  async function addSelectedToVocabulary() {
    const itemText = selectionPopup?.itemText.trim() ?? "";
    if (!itemText) return;

    if (onCaptured) {
      const resolvedPreview = await resolvePreviewForCapture(itemText);
      onCaptured({
        itemText,
        itemType: itemText.includes(" ") ? "phrase" : "word",
        sourceType: "passage",
        contextText: buildSnippet(displayPassageText, itemText),
        preview: resolvedPreview
          ? {
              plainEnglishMeaning: resolvedPreview.plain_english_meaning,
              translation: resolvedPreview.translation,
              contextMeaning: resolvedPreview.context_meaning,
            }
          : null,
      });
      setCaptureToast(itemText);
      window.setTimeout(() => {
        setCaptureToast((current) => (current === itemText ? null : current));
      }, 1600);
      setSelectionPopup(null);
      window.getSelection()?.removeAllRanges();
      return;
    }

    setSaving(true);

    try {
      const resolvedPreview = await resolvePreviewForCapture(itemText);
      await fetch("/api/vocabulary/capture-inline", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId,
          lessonId,
          passageId,
          itemText,
          itemType: itemText.includes(" ") ? "phrase" : "word",
          sourceType: "passage",
          contextText: buildSnippet(displayPassageText, itemText),
          metadata: {
            preview: resolvedPreview
              ? {
                  plainEnglishMeaning: resolvedPreview.plain_english_meaning,
                  translation: resolvedPreview.translation,
                  contextMeaning: resolvedPreview.context_meaning,
                }
              : null,
          },
        }),
      });
      setSelectionPopup(null);
      window.getSelection()?.removeAllRanges();
    } catch (error) {
      console.error("capture-inline error", error);
      alert("Failed to save selected vocabulary");
    } finally {
      setSaving(false);
    }
  }

  function openCard(
    event: React.MouseEvent<HTMLSpanElement>,
    item: KnownWord,
    pinned = false
  ) {
    const rect = event.currentTarget.getBoundingClientRect();
    const position = clampCardPosition(rect.left + rect.width / 2 - 160, rect.bottom + 12);
    setHoverCard({
      x: position.x,
      y: position.y,
      item,
      pinned,
    });
  }

  function maybeCloseCard() {
    if (hoverCard?.pinned) return;
    setHoverCard(null);
  }

  function tokenize(text: string) {
    return text.split(/(\s+)/g);
  }

  function clearLongPress() {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  }

  function handleTokenLongPress(token: string, touch: TouchPoint | null = null) {
    if (mode !== "capture" && mode !== "audio_review") {
      return;
    }

    const normalized = normalizeWord(token);
    if (!normalized) {
      return;
    }

    const position = clampPopupPosition(
      (touch?.clientX ?? 96) - 74,
      (touch?.clientY ?? 96) - 60
    );

    setSelectionPopup({
      ...position,
      itemText: normalized,
      itemType: "word",
    });
    window.getSelection()?.removeAllRanges();
  }

  function startLongPress(token: string, touch: TouchPoint | null = null) {
    if (mode !== "capture" && mode !== "audio_review") {
      return;
    }

    clearLongPress();
    longPressTimeoutRef.current = setTimeout(() => {
      handleTokenLongPress(token, touch);
    }, 420);
  }

  useEffect(() => {
    if (!selectionPopup) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-reading-capture-popup='true']")) {
        return;
      }

      setSelectionPopup(null);
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [selectionPopup]);

  useEffect(() => {
    if (!hoverCard?.pinned) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-reading-known-card='true']")) {
        return;
      }

      setHoverCard(null);
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [hoverCard]);

  function openPinnedReviewCard(
    item: KnownWord,
    element: HTMLSpanElement
  ) {
    const rect = element.getBoundingClientRect();
    const position = clampCardPosition(rect.left + rect.width / 2 - 160, rect.bottom + 12);
    setHoverCard({
      x: position.x,
      y: position.y,
      item,
      pinned: true,
    });
  }

  const renderedTokens = useMemo(() => {
    const tokens = tokenize(displayPassageText);
    let cursor = 0;

    return tokens.map((token, index) => {
      const tokenStart = cursor;
      const tokenEnd = tokenStart + token.length;
      cursor = tokenEnd;

      const isHighlighted =
        highlightRange !== null &&
        token.trim().length > 0 &&
        tokenStart < highlightRange.end &&
        tokenEnd > highlightRange.start;
      const normalized = normalizeWord(token);

      if (!normalized) {
        return (
          <span
            key={`${token}-${index}`}
            className={isHighlighted ? "reading-focus-highlight" : undefined}
          >
            {token}
          </span>
        );
      }

      const candidates = getWordCandidates(token);

      let known = null;
      for (const candidate of candidates) {
        const found = knownWordsMap.get(candidate);
        if (found) {
          known = found;
          break;
        }
      }

      if (!known) {
        const tokenKey = `${token}-${index}`;

        return (
          <span
            key={tokenKey}
            className={isHighlighted ? "reading-focus-highlight" : undefined}
            onTouchStart={(event) => startLongPress(token, event.touches[0] ?? null)}
            onTouchEnd={clearLongPress}
            onTouchMove={clearLongPress}
            onTouchCancel={clearLongPress}
          >
            {token}
          </span>
        );
      }

      const tokenKey = `${token}-${index}`;

      return (
        <span
          key={tokenKey}
          className={`cursor-pointer ${getKnownWordTokenClass(known, mode)} ${isHighlighted ? "reading-focus-highlight" : ""}`}
          onMouseEnter={(e) => {
            if (mode === "review") {
              openCard(e, known, false);
            }
          }}
          onMouseLeave={() => {
            if (mode === "review") {
              maybeCloseCard();
            }
          }}
          onContextMenu={(e) => {
            if (mode !== "review") {
              return;
            }
            e.preventDefault();
            openCard(e, known, true);
          }}
          onTouchStart={(event) => startLongPress(token, event.touches[0] ?? null)}
          onTouchEnd={clearLongPress}
          onTouchMove={clearLongPress}
          onTouchCancel={clearLongPress}
          onClick={(event) => {
            if (mode === "review") {
              openPinnedReviewCard(known, event.currentTarget);
              return;
            }

            if (mode === "audio_review") {
              openPinnedReviewCard(known, event.currentTarget);
            }
          }}
        >
          {token}
        </span>
      );
    });
  }, [displayPassageText, highlightRange, mode, knownWordsMap, hoverCard?.pinned]);

  return (
    <div className="relative space-y-3">
      <div
        className="reading-text"
        onMouseUp={handleMouseUp}
      >
        {renderedTokens}
      </div>

      {selectionPopup && (mode === "capture" || mode === "audio_review") ? (
        <div
          data-reading-capture-popup="true"
          className="fixed z-50 w-[min(20rem,calc(100vw-1.5rem))]"
          style={{ left: selectionPopup.x, top: selectionPopup.y }}
        >
          <div className="surface-panel rounded-[1.35rem] p-4 shadow-xl backdrop-blur">
            <div className="token-text-primary text-base font-semibold">
              {selectionPopup.itemText}
            </div>

            <div className="token-text-secondary mt-2 space-y-2 text-sm leading-6">
              {previewLoading ? (
                <div>Looking up meaning...</div>
              ) : preview ? (
                <>
                  <div>{preview.context_meaning || preview.plain_english_meaning}</div>
                  <div className="surface-soft-panel space-y-1 rounded-2xl px-3 py-3">
                    <div>
                      <span className="token-text-primary font-semibold">Meaning:</span>{" "}
                      {preview.plain_english_meaning}
                    </div>
                    {preview.translation ? (
                      <div>
                        <span className="token-text-primary font-semibold">Translation:</span>{" "}
                        {preview.translation}
                      </div>
                    ) : null}
                  </div>
                </>
              ) : previewError ? (
                <div className="token-text-muted">Meaning preview is not ready, but you can still save it.</div>
              ) : (
                <div className="token-text-muted">Save this word to review it later.</div>
              )}
            </div>

            <button
              type="button"
              onClick={addSelectedToVocabulary}
              disabled={saving}
              className="primary-button mt-3 min-h-12 w-full disabled:opacity-50"
            >
              {saving ? "Saving..." : "Add to Vocabulary"}
            </button>
          </div>
        </div>
      ) : null}

      {hoverCard && (mode === "review" || mode === "audio_review") ? (
        <div
          data-reading-known-card="true"
          className="surface-panel fixed z-50 w-[min(18rem,calc(100vw-1.5rem))] space-y-3 rounded-[1.35rem] p-4 shadow-xl"
          style={{ left: hoverCard.x, top: hoverCard.y }}
          onMouseEnter={() => {
            if (hoverCard) setHoverCard({ ...hoverCard });
          }}
          onMouseLeave={() => {
            if (!hoverCard?.pinned) setHoverCard(null);
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="token-text-primary text-base font-semibold">{hoverCard.item.item_text}</div>

            {hoverCard.pinned ? (
              <button
                type="button"
                onClick={() => setHoverCard(null)}
                className="secondary-button rounded-full px-3 py-1.5 text-xs"
              >
                Close
              </button>
            ) : null}
          </div>

          {hoverCard.item.english_explanation ? (
            <div>
              <div className="token-text-muted text-xs font-semibold uppercase tracking-[0.14em]">Meaning</div>
              <div className="token-text-secondary mt-1 text-sm leading-6">
                {hoverCard.item.english_explanation}
              </div>
            </div>
          ) : null}

          {hoverCard.item.translated_explanation ? (
            <div>
              <div className="token-text-muted text-xs font-semibold uppercase tracking-[0.14em]">Translation</div>
              <div className="token-text-secondary mt-1 text-sm leading-6">
                {hoverCard.item.translated_explanation}
              </div>
            </div>
          ) : null}

          {mode === "review" ? (
            <div className="token-text-muted text-xs">Hover to preview. Tap to pin.</div>
          ) : null}
        </div>
      ) : null}

      {captureToast ? (
        <div className="pointer-events-none fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-40 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white shadow-xl sm:left-auto sm:right-6 sm:max-w-sm">
          Added "{captureToast}" to this lesson's vocabulary list.
        </div>
      ) : null}
    </div>
  );
}
