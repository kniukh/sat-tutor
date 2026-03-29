"use client";

import { useMemo, useRef, useState } from "react";

type KnownWord = {
  id: string;
  item_text: string;
  english_explanation?: string | null;
  translated_explanation?: string | null;
  context_sentence?: string | null;
  audio_url?: string | null;
};

type Props = {
  studentId: string;
  lessonId: string;
  passageId?: string;
  passageText: string;
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

type TutorPopupState = {
  x: number;
  y: number;
  text: string;
  explanation: string | null;
  loading: boolean;
  error: string | null;
} | null;

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

export default function InteractivePassageReader({
  studentId,
  lessonId,
  passageId,
  passageText,
  knownWords = [],
  onCaptured,
  mode = "reference",
}: Props) {
  const [selection, setSelection] = useState("");
  const [saving, setSaving] = useState(false);
  const [popup, setPopup] = useState<{ x: number; y: number } | null>(null);
  const [hoverCard, setHoverCard] = useState<HoverCardState>(null);
  const [tutorPopup, setTutorPopup] = useState<TutorPopupState>(null);
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

  function handleMouseUp() {
    if (mode !== "capture") {
      return;
    }

    const sel = window.getSelection();
    const text = sel?.toString()?.trim() ?? "";

    if (!text) {
      setSelection("");
      setPopup(null);
      setTutorPopup(null);
      return;
    }

    const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
    const rect = range?.getBoundingClientRect();

    setSelection(text);

    if (rect) {
      setPopup({
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY - 40,
      });
    }
  }

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
    const itemText = selection.trim();
    if (!itemText) return;

    if (onCaptured) {
      queueCapturedItem(itemText);
      setSelection("");
      setPopup(null);
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
        }),
      });
      setSelection("");
      setPopup(null);
      window.getSelection()?.removeAllRanges();
    } catch (error) {
      console.error("capture-inline error", error);
      alert("Failed to save selected vocabulary");
    } finally {
      setSaving(false);
    }
  }

  async function explainSelection() {
    const itemText = selection.trim();
    if (!itemText || !popup) return;

    setTutorPopup({
      x: popup.x,
      y: popup.y + 52,
      text: itemText,
      explanation: null,
      loading: true,
      error: null,
    });

    try {
      const response = await fetch("/api/ai/tutor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId,
          lessonId,
          selectedText: itemText,
          passageText,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to explain selected text");
      }

      setTutorPopup((prev) =>
        prev
          ? {
              ...prev,
              explanation: payload.data.explanation,
              loading: false,
              error: null,
            }
          : prev
      );
    } catch (error: any) {
      setTutorPopup((prev) =>
        prev
          ? {
              ...prev,
              explanation: null,
              loading: false,
              error: error?.message ?? "AI explanation is unavailable right now.",
            }
          : prev
      );
    }
  }

  function openCard(
    event: React.MouseEvent<HTMLSpanElement>,
    item: KnownWord,
    pinned = false
  ) {
    const rect = event.currentTarget.getBoundingClientRect();
    setHoverCard({
      x: rect.left + window.scrollX,
      y: rect.bottom + window.scrollY + 8,
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

  function handleTokenLongPress(token: string) {
    if (mode !== "capture") {
      return;
    }

    const normalized = normalizeWord(token);
    if (!normalized) {
      return;
    }

    queueCapturedItem(normalized);
  }

  function startLongPress(token: string) {
    if (mode !== "capture") {
      return;
    }

    clearLongPress();
    longPressTimeoutRef.current = setTimeout(() => {
      handleTokenLongPress(token);
    }, 420);
  }

  function handleAudioWordTap(tokenKey: string, item: KnownWord) {
    if (mode !== "audio_review") {
      return;
    }

    const now = Date.now();
    const lastTap = lastTappedWordRef.current;

    if (lastTap && lastTap.key === tokenKey && now - lastTap.at < 420) {
      playAudio(item.audio_url);
      lastTappedWordRef.current = null;
      return;
    }

    lastTappedWordRef.current = { key: tokenKey, at: now };
  }

  const renderedTokens = useMemo(() => {
    const tokens = tokenize(passageText);

    return tokens.map((token, index) => {
      const normalized = normalizeWord(token);

      if (!normalized) {
        return <span key={`${token}-${index}`}>{token}</span>;
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
            onTouchStart={() => startLongPress(token)}
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
          className={`cursor-pointer underline decoration-2 ${
            mode === "audio_review"
              ? "decoration-emerald-500 decoration-wavy"
              : "decoration-blue-500"
          }`}
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
          onClick={() => handleAudioWordTap(tokenKey, known)}
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
  }, [passageText, knownWordsMap, hoverCard?.pinned]);

  return (
    <div className="relative space-y-3">
      <audio ref={audioRef} hidden />

      <div
        className="whitespace-pre-wrap text-[18px] leading-8 text-slate-900 select-text sm:text-[19px] sm:leading-9"
        onMouseUp={handleMouseUp}
      >
        {renderedTokens}
      </div>

      {popup && selection && mode === "capture" ? (
        <div className="fixed z-50" style={{ left: popup.x, top: popup.y }}>
          <div className="flex items-center gap-2 rounded-xl bg-white/95 p-2 shadow-lg ring-1 ring-slate-200 backdrop-blur">
            <button
              type="button"
              onClick={addSelectedToVocabulary}
              disabled={saving}
              className="px-3 py-2 rounded-lg bg-black text-white text-sm disabled:opacity-50"
            >
              {saving ? "Saving..." : "Add to Vocabulary"}
            </button>
            {mode === "capture" ? (
              <button
                type="button"
                onClick={explainSelection}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900"
              >
                Explain
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {tutorPopup ? (
        <div
          className="fixed z-50 w-96 rounded-2xl border bg-white p-4 shadow-xl"
          style={{ left: tutorPopup.x, top: tutorPopup.y }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                AI Tutor
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {tutorPopup.text}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setTutorPopup(null)}
              className="rounded-lg border px-2 py-1 text-sm text-slate-600"
            >
              Close
            </button>
          </div>

          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            {tutorPopup.loading ? "Thinking..." : null}
            {!tutorPopup.loading && tutorPopup.explanation ? tutorPopup.explanation : null}
            {!tutorPopup.loading && tutorPopup.error ? tutorPopup.error : null}
          </div>
        </div>
      ) : null}

      {hoverCard && mode === "review" ? (
        <div
          className="fixed z-50 w-80 rounded-xl border bg-white shadow-xl p-4 space-y-3"
          style={{ left: hoverCard.x, top: hoverCard.y }}
          onMouseEnter={() => {
            if (hoverCard) setHoverCard({ ...hoverCard });
          }}
          onMouseLeave={() => {
            if (!hoverCard?.pinned) setHoverCard(null);
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-lg font-semibold">{hoverCard.item.item_text}</div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => playAudio(hoverCard.item.audio_url)}
                disabled={!hoverCard.item.audio_url}
                className="text-xl disabled:opacity-40"
                title="Play audio"
              >
                🔊
              </button>

              {hoverCard.pinned ? (
                <button
                  type="button"
                  onClick={() => setHoverCard(null)}
                  className="text-sm px-2 py-1 rounded border"
                >
                  Close
                </button>
              ) : null}
            </div>
          </div>

          {hoverCard.item.english_explanation ? (
            <div>
              <div className="text-xs text-slate-500">Meaning</div>
              <div className="text-sm text-slate-800">
                {hoverCard.item.english_explanation}
              </div>
            </div>
          ) : null}

          {hoverCard.item.translated_explanation ? (
            <div>
              <div className="text-xs text-slate-500">Translation</div>
              <div className="text-sm text-slate-800">
                {hoverCard.item.translated_explanation}
              </div>
            </div>
          ) : null}

          <div>
            <div className="text-xs text-slate-500">Meaning in context</div>
            <div className="text-sm text-slate-800">
              {hoverCard.item.context_sentence || "Context not available yet."}
            </div>
          </div>

          {hoverCard.item.audio_url ? (
            <div className="text-xs text-green-600">Audio ready</div>
          ) : (
            <div className="text-xs text-amber-600">Audio not ready yet</div>
          )}

          <div className="text-xs text-slate-400">
            Hover to preview • Right-click to pin
          </div>
        </div>
      ) : null}

      {captureToast ? (
        <div className="pointer-events-none fixed inset-x-4 bottom-4 z-40 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white shadow-xl sm:left-auto sm:right-6 sm:max-w-sm">
          Added "{captureToast}" to this lesson's vocabulary list.
        </div>
      ) : null}
    </div>
  );
}
