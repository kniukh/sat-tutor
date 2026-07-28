"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  audioUrl?: string | null;
  startMs?: number | null;
  endMs?: number | null;
  passageText?: string | null;
  sentenceTimings?: PassageAudioSentenceTiming[];
  alignmentConfidence?: number | null;
  compact?: boolean;
  variant?: "panel" | "topbar";
  onActiveSentenceChange?: (sentenceText: string | null) => void;
};

export type PassageAudioSentenceTiming = {
  sentenceIndex?: number | null;
  sentenceText: string;
  audioStartMs: number | null;
  audioEndMs: number | null;
  confidence?: number | null;
};

const SENTENCE_END_ABBREVIATIONS = new Set([
  "mr.",
  "mrs.",
  "ms.",
  "dr.",
  "prof.",
  "sr.",
  "jr.",
  "st.",
  "mt.",
  "vs.",
  "etc.",
  "e.g.",
  "i.e.",
  "u.s.",
  "u.k.",
]);

function shouldMergeSentenceBoundary(current: string, next: string) {
  const tail = current.trim().toLowerCase();
  if (!tail || !next.trim()) {
    return false;
  }

  const lastToken = tail.split(/\s+/).pop() ?? "";
  return SENTENCE_END_ABBREVIATIONS.has(lastToken) || /^[a-z]\.$/i.test(lastToken);
}

function splitIntoSentences(text: string) {
  const rawSentences = (text.replace(/\r/g, "").match(/[^.!?]+(?:[.!?]+["'”’)\]]*)?|[^.!?]+$/g) ?? [])
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const merged: string[] = [];
  for (const sentence of rawSentences) {
    const previous = merged[merged.length - 1];
    if (previous && shouldMergeSentenceBoundary(previous, sentence)) {
      merged[merged.length - 1] = `${previous} ${sentence}`.replace(/\s+/g, " ").trim();
      continue;
    }

    merged.push(sentence);
  }

  return merged;
}

function countWords(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

function PlayIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="currentColor"
    >
      <path d="M8 5.75v12.5c0 .6.66.96 1.16.64l9.7-6.25a.76.76 0 0 0 0-1.28l-9.7-6.25A.75.75 0 0 0 8 5.75Z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="currentColor"
    >
      <path d="M7 7.75c0-.41.34-.75.75-.75h8.5c.41 0 .75.34.75.75v8.5c0 .41-.34.75-.75.75h-8.5a.75.75 0 0 1-.75-.75v-8.5Z" />
    </svg>
  );
}

function buildEstimatedSentenceTimings(params: {
  passageText?: string | null;
  startMs: number;
  endMs: number | null;
}): PassageAudioSentenceTiming[] {
  if (!params.passageText || !params.endMs || params.endMs <= params.startMs) {
    return [];
  }

  const sentences = splitIntoSentences(params.passageText);
  const totalWords = sentences.reduce((sum, sentence) => sum + Math.max(1, countWords(sentence)), 0);
  const durationMs = params.endMs - params.startMs;
  let cursorMs = params.startMs;

  return sentences.map((sentence, index) => {
    const isLast = index === sentences.length - 1;
    const sentenceDuration = Math.round((Math.max(1, countWords(sentence)) / Math.max(1, totalWords)) * durationMs);
    const audioStartMs = cursorMs;
    const audioEndMs = isLast ? params.endMs : cursorMs + sentenceDuration;
    cursorMs = audioEndMs;

    return {
      sentenceIndex: index,
      sentenceText: sentence,
      audioStartMs,
      audioEndMs,
      confidence: 0.45,
    };
  });
}

export default function PassageAudioControls({
  audioUrl,
  startMs,
  endMs,
  passageText,
  sentenceTimings = [],
  compact = false,
  variant = "panel",
  onActiveSentenceChange,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeSentenceRef = useRef<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const hasAudio = Boolean(audioUrl);
  const startSeconds = typeof startMs === "number" ? Math.max(0, startMs / 1000) : 0;
  const endSeconds = typeof endMs === "number" && endMs > 0 ? endMs / 1000 : null;
  const resolvedSentenceTimings = useMemo(
    () =>
      sentenceTimings.length > 0
        ? sentenceTimings
        : buildEstimatedSentenceTimings({
            passageText,
            startMs: typeof startMs === "number" ? startMs : 0,
            endMs: typeof endMs === "number" ? endMs : null,
          }),
    [endMs, passageText, sentenceTimings, startMs]
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    function handleTimeUpdate() {
      if (!audio) return;
      const currentMs = audio.currentTime * 1000;
      const activeSentence =
        resolvedSentenceTimings.find((sentence) => {
          if (typeof sentence.audioStartMs !== "number" || typeof sentence.audioEndMs !== "number") {
            return false;
          }

          return currentMs >= sentence.audioStartMs && currentMs < sentence.audioEndMs;
        })?.sentenceText ?? null;

      if (activeSentenceRef.current !== activeSentence) {
        activeSentenceRef.current = activeSentence;
        onActiveSentenceChange?.(activeSentence);
      }

      if (endSeconds && audio.currentTime >= endSeconds) {
        audio.pause();
        audio.currentTime = startSeconds;
        setIsPlaying(false);
        activeSentenceRef.current = null;
        onActiveSentenceChange?.(null);
      }
    }

    audio.addEventListener("timeupdate", handleTimeUpdate);
    return () => audio.removeEventListener("timeupdate", handleTimeUpdate);
  }, [endSeconds, onActiveSentenceChange, resolvedSentenceTimings, startSeconds]);

  useEffect(() => {
    activeSentenceRef.current = null;
    onActiveSentenceChange?.(null);
  }, [audioUrl, startMs, endMs, onActiveSentenceChange]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  if (!hasAudio) {
    return null;
  }

  async function startPlayback() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audio.currentTime < startSeconds || (endSeconds && audio.currentTime >= endSeconds)) {
      audio.currentTime = startSeconds;
    }

    audio.playbackRate = playbackRate;

    try {
      await audio.play();
      setIsPlaying(true);
    } catch (error) {
      console.error("Passage audio playback failed", error);
      setIsPlaying(false);
    }
  }

  function stopPlayback() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.pause();
    audio.currentTime = startSeconds;
    setIsPlaying(false);
    activeSentenceRef.current = null;
    onActiveSentenceChange?.(null);
  }

  return (
    <div
      className={
        variant === "topbar"
          ? "w-full"
          : `surface-soft-panel ${compact ? "p-3" : "p-4"} space-y-3`
      }
    >
      <audio
        ref={audioRef}
        src={audioUrl ?? undefined}
        preload="metadata"
        onEnded={() => {
          setIsPlaying(false);
          activeSentenceRef.current = null;
          onActiveSentenceChange?.(null);
        }}
        onPause={() => setIsPlaying(false)}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="app-kicker token-text-muted">Read + Listen</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void startPlayback()}
            disabled={isPlaying}
            aria-label="Start audio"
            title="Start audio"
            className="primary-button flex min-h-11 w-11 shrink-0 items-center justify-center px-0 disabled:opacity-55"
          >
            <PlayIcon />
          </button>
          <button
            type="button"
            onClick={stopPlayback}
            aria-label="Stop audio"
            title="Stop audio"
            className="secondary-button flex min-h-11 w-11 shrink-0 items-center justify-center px-0"
          >
            <StopIcon />
          </button>
          <select
            value={playbackRate}
            onChange={(event) => setPlaybackRate(Number(event.target.value))}
            className="surface-panel token-text-primary min-h-11 rounded-xl border border-[var(--color-border)] px-3 text-sm font-semibold"
            aria-label="Audio speed"
          >
            {[0.8, 0.9, 1, 1.1, 1.2].map((rate) => (
              <option key={rate} value={rate}>
                {rate}x
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
