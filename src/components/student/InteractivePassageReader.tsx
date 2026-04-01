"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  onCaptured?: (item: {
    itemText: string;
    itemType: "word" | "phrase";
    sourceType: "passage";
    contextText: string | null;
  }) => void;
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

  const start = Math.max(0, index - 80);
  const end = Math.min(fullText.length, index + itemText.length + 80);
  return fullText.slice(start, end).trim();
}

function getKnownWordTokenClass(item: KnownWord, mode: Props["mode"]) {
  if (item.review_ready || item.review_bucket === "weak_again") {
    return "rounded-sm bg-amber-100/38 px-[1px] underline decoration-amber-500/75 decoration-[1.5px] underline-offset-[0.18em]";
  }

  if (item.review_bucket === "recently_failed") {
    return "rounded-sm bg-rose-100/38 px-[1px] underline decoration-rose-500/75 decoration-[1.5px] underline-offset-[0.18em]";
  }

  if (mode === "audio_review") {
    return "rounded-sm bg-emerald-100/28 px-[1px] underline decoration-emerald-500/70 decoration-[1.5px] underline-offset-[0.18em]";
  }

  return "rounded-sm bg-sky-100/28 px-[1px] underline decoration-sky-500/70 decoration-[1.5px] underline-offset-[0.18em]";
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTappedWordRef = useRef<{ key: string; at: number } | null>(null);

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
    () => findHighlightRange(passageText, highlightText),
    [passageText, highlightText]
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
  }, [selectionPopup, knownWordsMap, studentId, lessonId, passageId]);

  function queueCapturedItem(itemText: string) {
    onCaptured?.({
      itemText,
      itemType: itemText.includes(" ") ? "phrase" : "word",
      sourceType: "passage",
      contextText: buildSnippet(passageText, itemText),
    });
    setCaptureToast(itemText);
    window.setTimeout(() => {
      setCaptureToast((current) => (current === itemText ? null : current));
    }, 1600);
  }

  async function addSelectedToVocabulary() {
    const itemText = selectionPopup?.itemText.trim() ?? "";
    if (!itemText) return;

    if (onCaptured) {
      queueCapturedItem(itemText);
      setSelectionPopup(null);
      window.getSelection()?.removeAllRanges();
      return;
    }

    setSaving(true);

    try {
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
          contextText: buildSnippet(passageText, itemText),
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

  function playAudio(url?: string | null) {
    if (!url) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = url;
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((e) => console.error("playAudio error", e));
    }
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

  function handleAudioWordTap(
    tokenKey: string,
    item: KnownWord,
    element: HTMLSpanElement
  ) {
    if (mode !== "audio_review") {
      return;
    }

    const rect = element.getBoundingClientRect();
    const position = clampCardPosition(rect.left + rect.width / 2 - 160, rect.bottom + 12);
    const now = Date.now();
    const lastTap = lastTappedWordRef.current;

    if (lastTap && lastTap.key === tokenKey && now - lastTap.at < 420) {
      playAudio(item.audio_url);
      setHoverCard({
        x: position.x,
        y: position.y,
        item,
        pinned: true,
      });
      lastTappedWordRef.current = null;
      return;
    }

    lastTappedWordRef.current = { key: tokenKey, at: now };
    setHoverCard({
      x: position.x,
      y: position.y,
      item,
      pinned: true,
    });
  }

  const renderedTokens = useMemo(() => {
    const tokens = tokenize(passageText);
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
          onClick={(event) => handleAudioWordTap(tokenKey, known, event.currentTarget)}
          onDoubleClick={() => {
            if (mode === "audio_review") {
              playAudio(known.audio_url);
            }
          }}
        >
          {token}
        </span>
      );
    });
  }, [highlightRange, mode, passageText, knownWordsMap, hoverCard?.pinned]);

  return (
    <div className="relative space-y-3">
      <audio ref={audioRef} hidden />

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
          <div className="rounded-[1.35rem] border border-slate-200 bg-white/98 p-4 shadow-xl backdrop-blur">
            <div className="text-base font-semibold text-slate-950">
              {selectionPopup.itemText}
            </div>

            <div className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
              {previewLoading ? (
                <div>Looking up meaning...</div>
              ) : preview ? (
                <>
                  <div>{preview.context_meaning || preview.plain_english_meaning}</div>
                  <div className="space-y-1 rounded-2xl bg-slate-50 px-3 py-3">
                    <div>
                      <span className="font-semibold text-slate-900">Meaning:</span>{" "}
                      {preview.plain_english_meaning}
                    </div>
                    {preview.translation ? (
                      <div>
                        <span className="font-semibold text-slate-900">Translation:</span>{" "}
                        {preview.translation}
                      </div>
                    ) : null}
                  </div>
                </>
              ) : previewError ? (
                <div className="text-slate-500">Meaning preview is not ready, but you can still save it.</div>
              ) : (
                <div className="text-slate-500">Save this word to review it later.</div>
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
          className="fixed z-50 w-[min(20rem,calc(100vw-1.5rem))] space-y-3 rounded-[1.35rem] border border-slate-200 bg-white/98 p-4 shadow-xl"
          style={{ left: hoverCard.x, top: hoverCard.y }}
          onMouseEnter={() => {
            if (hoverCard) setHoverCard({ ...hoverCard });
          }}
          onMouseLeave={() => {
            if (!hoverCard?.pinned) setHoverCard(null);
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-base font-semibold text-slate-950">{hoverCard.item.item_text}</div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => playAudio(hoverCard.item.audio_url)}
                disabled={!hoverCard.item.audio_url}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40"
                title="Play audio"
              >
                Play audio
              </button>

              {hoverCard.pinned ? (
                <button
                  type="button"
                  onClick={() => setHoverCard(null)}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  Close
                </button>
              ) : null}
            </div>
          </div>

          {hoverCard.item.english_explanation ? (
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Meaning</div>
              <div className="mt-1 text-sm leading-6 text-slate-800">
                {hoverCard.item.english_explanation}
              </div>
            </div>
          ) : null}

          {hoverCard.item.translated_explanation ? (
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Translation</div>
              <div className="mt-1 text-sm leading-6 text-slate-800">
                {hoverCard.item.translated_explanation}
              </div>
            </div>
          ) : null}

          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">In this passage</div>
            <div className="mt-1 text-sm leading-6 text-slate-800">
              {hoverCard.item.context_sentence || "Context not available yet."}
            </div>
          </div>

          {mode === "review" ? (
            <div className="text-xs text-slate-400">Hover to preview. Right click to keep it open.</div>
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
