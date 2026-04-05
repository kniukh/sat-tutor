"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  buildInlinePreviewCacheKey,
  getCachedInlinePreview,
  setCachedInlinePreview,
} from "@/services/vocabulary/inline-preview-cache.client";
import type { CapturedVocabularyItem } from "./PassageVocabularyCapture";

type KnownWord = {
  item_text: string;
  english_explanation?: string | null;
  translated_explanation?: string | null;
  review_bucket?:
    | "recently_failed"
    | "weak_again"
    | "overdue"
    | "reinforcement"
    | "scheduled"
    | null;
  review_ready?: boolean;
};

type InlinePreview = {
  item_text: string;
  item_type: "word" | "phrase";
  plain_english_meaning: string;
  translation: string;
  context_meaning: string;
};

type Props = {
  studentId: string;
  lessonId: string;
  passageId?: string;
  text: string;
  sourceType: "question" | "answer" | "vocab_drill";
  sourceText?: string | null;
  className?: string;
  as?: "span" | "div";
  knownWords?: KnownWord[];
  onCaptured?: (item: CapturedVocabularyItem) => void;
};

type SelectionPopupState = {
  x: number;
  y: number;
  itemText: string;
  itemType: "word" | "phrase";
} | null;

type KnownWordHoverCardState = {
  x: number;
  y: number;
  item: KnownWord;
} | null;

const POPUP_WIDTH = 320;
const POPUP_HEIGHT = 232;
const VIEWPORT_GUTTER = 12;
const BOTTOM_BAR_SAFE_AREA = 124;

function normalizeWord(word: string) {
  return word
    .toLowerCase()
    .replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, "")
    .trim();
}

function tokenize(text: string) {
  return text.split(/(\s+)/g);
}

function clampPopupPosition(x: number, y: number) {
  if (typeof window === "undefined") {
    return { x, y };
  }

  const popupWidth = Math.min(POPUP_WIDTH, window.innerWidth - VIEWPORT_GUTTER * 2);
  const maxX = Math.max(VIEWPORT_GUTTER, window.innerWidth - popupWidth - VIEWPORT_GUTTER);
  const minY = VIEWPORT_GUTTER;
  const maxY = Math.max(
    VIEWPORT_GUTTER,
    window.innerHeight - POPUP_HEIGHT - BOTTOM_BAR_SAFE_AREA
  );

  return {
    x: Math.min(Math.max(VIEWPORT_GUTTER, x), maxX),
    y: Math.min(Math.max(minY, y), maxY),
  };
}

function getPopupPositionFromAnchor(params: {
  anchorLeft: number;
  anchorTop: number;
  anchorWidth?: number;
  anchorHeight?: number;
}) {
  const {
    anchorLeft,
    anchorTop,
    anchorWidth = 0,
    anchorHeight = 0,
  } = params;

  const centeredX = anchorLeft + anchorWidth / 2 - POPUP_WIDTH / 2;
  const preferredYAbove = anchorTop - POPUP_HEIGHT - 14;
  const preferredYBelow = anchorTop + anchorHeight + 14;

  if (typeof window === "undefined") {
    return clampPopupPosition(centeredX, preferredYAbove);
  }

  const hasRoomAbove = preferredYAbove >= VIEWPORT_GUTTER;
  const hasRoomBelow =
    preferredYBelow <= window.innerHeight - POPUP_HEIGHT - BOTTOM_BAR_SAFE_AREA;

  const chosenY = hasRoomAbove
    ? preferredYAbove
    : hasRoomBelow
      ? preferredYBelow
      : preferredYAbove;

  return clampPopupPosition(centeredX, chosenY);
}

function buildSnippet(fullText: string, itemText: string) {
  const lowerText = fullText.toLowerCase();
  const lowerItem = itemText.toLowerCase();
  const index = lowerText.indexOf(lowerItem);

  if (index === -1) {
    return fullText.replace(/\s+/g, " ").trim().slice(0, 72);
  }

  const start = Math.max(0, index - 28);
  const end = Math.min(fullText.length, index + itemText.length + 28);
  return fullText.slice(start, end).replace(/\s+/g, " ").trim();
}

function getKnownWordTokenClass(item: KnownWord) {
  if (item.review_ready || item.review_bucket === "weak_again") {
    return "reading-known-word reading-known-word--review-ready";
  }

  if (item.review_bucket === "recently_failed") {
    return "reading-known-word reading-known-word--recently-failed";
  }

  return "reading-known-word reading-known-word--known";
}

function getKnownCardPosition(element: HTMLSpanElement) {
  const rect = element.getBoundingClientRect();
  return getPopupPositionFromAnchor({
    anchorLeft: rect.left,
    anchorTop: rect.top,
    anchorWidth: rect.width,
    anchorHeight: rect.height,
  });
}

export default function InlineVocabularyCaptureText({
  studentId,
  lessonId,
  passageId,
  text,
  sourceType,
  sourceText,
  className,
  as = "span",
  knownWords = [],
  onCaptured,
}: Props) {
  const rootRef = useRef<HTMLDivElement | HTMLSpanElement | null>(null);
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClickUntilRef = useRef<number>(0);
  const [selectionPopup, setSelectionPopup] = useState<SelectionPopupState>(null);
  const [preview, setPreview] = useState<InlinePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewRequested, setPreviewRequested] = useState(false);
  const [saving, setSaving] = useState(false);
  const [captureToast, setCaptureToast] = useState<string | null>(null);
  const [hoverKnownWordCard, setHoverKnownWordCard] =
    useState<KnownWordHoverCardState>(null);
  const [mounted, setMounted] = useState(false);
  const contextSourceText = sourceText?.trim() || text;

  const knownWordsMap = useMemo(() => {
    const map = new Map<string, KnownWord>();
    for (const item of knownWords) {
      const key = normalizeWord(item.item_text);
      if (!key || map.has(key)) {
        continue;
      }

      map.set(key, item);
    }

    return map;
  }, [knownWords]);

  function clearLongPress() {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  }

  function closePopup() {
    setSelectionPopup(null);
    setHoverKnownWordCard(null);
    setPreview(null);
    setPreviewError(null);
    setPreviewLoading(false);
    setPreviewRequested(false);
    window.getSelection()?.removeAllRanges();
  }

  function openSelectionPopup(itemText: string, x: number, y: number) {
    const trimmed = itemText.trim();
    if (!trimmed) {
      return;
    }

    suppressClickUntilRef.current = Date.now() + 700;
    const position = clampPopupPosition(x, y);
    setSelectionPopup({
      x: position.x,
      y: position.y,
      itemText: trimmed,
      itemType: trimmed.includes(" ") ? "phrase" : "word",
    });
    setPreview(null);
    setPreviewError(null);
    setPreviewLoading(false);
    setPreviewRequested(false);
  }

  function handleMouseUp() {
    const selection = window.getSelection();
    const selectedText = selection?.toString()?.trim() ?? "";

    if (!selectedText) {
      return;
    }

    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const commonAncestor = range?.commonAncestorContainer ?? null;
    const root = rootRef.current;

    if (!range || !root) {
      return;
    }

    const anchorNode =
      commonAncestor && commonAncestor.nodeType === Node.TEXT_NODE
        ? commonAncestor.parentElement
        : (commonAncestor as HTMLElement | null);

    if (!anchorNode || !root.contains(anchorNode)) {
      return;
    }

    const rect = range.getBoundingClientRect();
    const position = getPopupPositionFromAnchor({
      anchorLeft: rect.left,
      anchorTop: rect.top,
      anchorWidth: rect.width,
      anchorHeight: rect.height,
    });
    openSelectionPopup(selectedText, position.x, position.y);
  }

  function startLongPress(rawToken: string, clientX?: number, clientY?: number) {
    const itemText = normalizeWord(rawToken);
    if (!itemText) {
      return;
    }

    clearLongPress();
    longPressTimeoutRef.current = setTimeout(() => {
      const position = getPopupPositionFromAnchor({
        anchorLeft: Math.max(VIEWPORT_GUTTER, (clientX ?? 24) - 18),
        anchorTop:
          Math.max(
            VIEWPORT_GUTTER,
            (clientY ?? (typeof window !== "undefined" ? window.innerHeight - 180 : 120)) - 18
          ),
        anchorWidth: 36,
        anchorHeight: 36,
      });
      openSelectionPopup(itemText, position.x, position.y);
    }, 420);
  }

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!selectionPopup) {
      return;
    }

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest("[data-inline-capture-popup='true']")) {
        return;
      }

      closePopup();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [selectionPopup]);

  useEffect(() => {
    if (!selectionPopup) {
      setPreview(null);
      setPreviewLoading(false);
      setPreviewError(null);
      return;
    }

    const known = knownWordsMap.get(normalizeWord(selectionPopup.itemText));
    if (known) {
      setPreview({
        item_text: known.item_text,
        item_type: selectionPopup.itemType,
        plain_english_meaning:
          known.english_explanation?.trim() || "Already in your lesson vocabulary.",
        translation: known.translated_explanation?.trim() || "",
        context_meaning:
          known.english_explanation?.trim() ||
          "This word is already being tracked in your review queue.",
      });
      setPreviewLoading(false);
      setPreviewError(null);
      return;
    }

    if (!previewRequested) {
      setPreview(null);
      setPreviewLoading(false);
      setPreviewError(null);
      return;
    }

    let cancelled = false;
    const cacheKey = buildInlinePreviewCacheKey({
      studentId,
      lessonId,
      itemText: selectionPopup.itemText,
      sourceText: contextSourceText,
    });
    const cachedPreview = getCachedInlinePreview(cacheKey);

    if (cachedPreview) {
      setPreview(cachedPreview);
      setPreviewLoading(false);
      setPreviewError(null);
      return;
    }

    async function loadPreview() {
      setPreview(null);
      setPreviewLoading(true);
      setPreviewError(null);

      try {
        const response = await fetch("/api/vocabulary/preview-inline", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId,
            lessonId,
            passageId,
            itemText: selectionPopup.itemText,
            sourceText: contextSourceText,
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
  }, [
    selectionPopup,
    knownWordsMap,
    studentId,
    lessonId,
    passageId,
    contextSourceText,
    previewRequested,
  ]);

  async function addSelectedToVocabulary() {
    const itemText = selectionPopup?.itemText.trim() ?? "";
    if (!itemText) {
      return;
    }

    setSaving(true);

    try {
      const capturedItem: CapturedVocabularyItem = {
        itemText,
        itemType: selectionPopup?.itemType ?? "word",
        sourceType,
        contextText: buildSnippet(contextSourceText, itemText),
        preview: preview
          ? {
              plainEnglishMeaning: preview.plain_english_meaning,
              translation: preview.translation,
              contextMeaning: preview.context_meaning,
            }
          : null,
      };

      if (onCaptured) {
        onCaptured(capturedItem);
        setCaptureToast(itemText);
        window.setTimeout(() => {
          setCaptureToast((current) => (current === itemText ? null : current));
        }, 1600);
        closePopup();
        return;
      }

      await fetch("/api/vocabulary/capture-inline", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          lessonId,
          passageId,
          itemText,
          itemType: capturedItem.itemType,
          sourceType,
          contextText: capturedItem.contextText,
          metadata: {
            source: "lesson_quiz",
            source_type: sourceType,
            context: contextSourceText,
            preview: capturedItem.preview ?? null,
          },
        }),
      });

      setCaptureToast(itemText);
      window.setTimeout(() => {
        setCaptureToast((current) => (current === itemText ? null : current));
      }, 1600);
      closePopup();
    } catch (error) {
      console.error("inline vocabulary capture error", error);
    } finally {
      setSaving(false);
    }
  }

  function suppressOptionClick(event: React.MouseEvent) {
    if (Date.now() < suppressClickUntilRef.current) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function renderTokens() {
    return tokenize(text).map((token, index) => {
      const normalized = normalizeWord(token);

      if (!normalized) {
        return <span key={`${token}-${index}`}>{token}</span>;
      }

      const knownWord = knownWordsMap.get(normalized);

      return (
        <span
          key={`${token}-${index}`}
          className={knownWord ? getKnownWordTokenClass(knownWord) : undefined}
          onMouseEnter={(event) => {
            if (!knownWord || selectionPopup) {
              return;
            }

            const position = getKnownCardPosition(event.currentTarget);
            setHoverKnownWordCard({
              x: position.x,
              y: position.y,
              item: knownWord,
            });
          }}
          onMouseLeave={() => {
            setHoverKnownWordCard(null);
          }}
          onTouchStart={(event) => {
            const touch = event.touches[0];
            startLongPress(token, touch?.clientX, touch?.clientY);
          }}
          onTouchEnd={clearLongPress}
          onTouchMove={clearLongPress}
          onTouchCancel={clearLongPress}
          onClickCapture={suppressOptionClick}
        >
          {token}
        </span>
      );
    });
  }

  return (
    <>
      {as === "div" ? (
        <div
          ref={rootRef as React.RefObject<HTMLDivElement>}
          className={className}
          onMouseUp={handleMouseUp}
        >
          {renderTokens() as ReactNode}
        </div>
      ) : (
        <span
          ref={rootRef as React.RefObject<HTMLSpanElement>}
          className={className}
          onMouseUp={handleMouseUp}
        >
          {renderTokens() as ReactNode}
        </span>
      )}

      {mounted && selectionPopup
        ? createPortal(
            <div
              data-inline-capture-popup="true"
              className="fixed z-[120] w-[min(20rem,calc(100vw-1.5rem))]"
              style={{ left: selectionPopup.x, top: selectionPopup.y }}
            >
              <div className="surface-panel rounded-[1.35rem] p-4 shadow-xl backdrop-blur">
                <div className="token-text-primary text-base font-semibold">
                  {selectionPopup.itemText}
                </div>

                {previewLoading || preview || previewError ? (
                  <div className="token-text-secondary mt-2 space-y-2 text-sm leading-6">
                    {previewLoading ? (
                      <div>Looking up meaning...</div>
                    ) : preview ? (
                      <>
                        <div className="token-text-secondary text-sm leading-6">
                          {preview.plain_english_meaning}
                        </div>
                        {preview.translation ? (
                          <div className="token-text-secondary text-sm leading-6">
                            {preview.translation}
                          </div>
                        ) : null}
                      </>
                    ) : previewError ? (
                      <div className="token-text-muted">
                        Meaning preview is not ready, but you can still save it.
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => void addSelectedToVocabulary()}
                  disabled={saving}
                  className="primary-button mt-3 min-h-12 w-full disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Add to Vocabulary"}
                </button>

                {!preview && !previewLoading && !previewError ? (
                  <button
                    type="button"
                    onClick={() => setPreviewRequested(true)}
                    className="secondary-button mt-3 min-h-11 w-full"
                  >
                    Show Meaning
                  </button>
                ) : null}
              </div>
            </div>,
            document.body
          )
        : null}

      {mounted && captureToast
        ? createPortal(
            <div className="pointer-events-none fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+6rem)] z-[115] rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white shadow-xl sm:left-auto sm:right-6 sm:max-w-sm">
              Added "{captureToast}" to vocabulary.
            </div>,
            document.body
          )
        : null}

      {mounted && hoverKnownWordCard && !selectionPopup
        ? createPortal(
            <div
              data-inline-known-card="true"
              className="surface-panel fixed z-[119] w-[min(18rem,calc(100vw-1.5rem))] space-y-2 rounded-[1.35rem] p-4 shadow-xl backdrop-blur"
              style={{ left: hoverKnownWordCard.x, top: hoverKnownWordCard.y }}
              onMouseEnter={() => {
                setHoverKnownWordCard((current) => (current ? { ...current } : current));
              }}
              onMouseLeave={() => setHoverKnownWordCard(null)}
            >
              <div className="token-text-primary text-base font-semibold">
                {hoverKnownWordCard.item.item_text}
              </div>

              {hoverKnownWordCard.item.english_explanation ? (
                <div className="token-text-secondary text-sm leading-6">
                  {hoverKnownWordCard.item.english_explanation}
                </div>
              ) : null}

              {hoverKnownWordCard.item.translated_explanation ? (
                <div className="token-text-secondary text-sm leading-6">
                  {hoverKnownWordCard.item.translated_explanation}
                </div>
              ) : null}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
