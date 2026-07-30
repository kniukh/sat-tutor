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
      width="20"
      height="20"
      className="block h-5 w-5 shrink-0"
      fill="currentColor"
    >
      <path d="M8 5.75v12.5c0 .6.66.96 1.16.64l9.7-6.25a.76.76 0 0 0 0-1.28l-9.7-6.25A.75.75 0 0 0 8 5.75Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      className="block h-5 w-5 shrink-0"
      fill="currentColor"
    >
      <path d="M7.75 5.5A1.25 1.25 0 0 0 6.5 6.75v10.5a1.25 1.25 0 0 0 2.5 0V6.75A1.25 1.25 0 0 0 7.75 5.5ZM16.25 5.5A1.25 1.25 0 0 0 15 6.75v10.5a1.25 1.25 0 0 0 2.5 0V6.75a1.25 1.25 0 0 0-1.25-1.25Z" />
    </svg>
  );
}

function RewindIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      className="block h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 8V4m0 0h4M4 4l3.2 3.2A7 7 0 1 1 5.6 14" />
      <path d="M10 10.5h1.5V16M14.5 11.2c.4-.5.9-.7 1.5-.7 1 0 1.8.7 1.8 1.6 0 1.8-3.3 2-3.3 3.9h3.4" />
    </svg>
  );
}

function ForwardIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      className="block h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 8V4m0 0h-4m4-0-3.2 3.2A7 7 0 1 0 18.4 14" />
      <path d="M6.1 10.5h1.5V16M10.6 11.2c.4-.5.9-.7 1.5-.7 1 0 1.8.7 1.8 1.6 0 1.8-3.3 2-3.3 3.9H14" />
    </svg>
  );
}

function formatAudioTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const minutes = Math.floor(safeSeconds / 60);
  return `${minutes}:${String(safeSeconds % 60).padStart(2, "0")}`;
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
  const [currentSeconds, setCurrentSeconds] = useState(0);
  const [loadedDuration, setLoadedDuration] = useState<number | null>(null);
  const hasAudio = Boolean(audioUrl);
  const startSeconds = typeof startMs === "number" ? Math.max(0, startMs / 1000) : 0;
  const endSeconds = typeof endMs === "number" && endMs > 0 ? endMs / 1000 : null;
  const resolvedEndSeconds =
    endSeconds ?? (loadedDuration && loadedDuration > startSeconds ? loadedDuration : null);
  const segmentDuration = resolvedEndSeconds
    ? Math.max(0, resolvedEndSeconds - startSeconds)
    : 0;
  const segmentPosition = Math.min(
    segmentDuration,
    Math.max(0, currentSeconds - startSeconds)
  );
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
      setCurrentSeconds(audio.currentTime);
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

  function pausePlayback() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.pause();
    setIsPlaying(false);
  }

  function seekToSegmentPosition(nextPosition: number) {
    const audio = audioRef.current;
    if (!audio) return;

    const upperBound = resolvedEndSeconds ?? audio.duration;
    const nextTime = Math.min(
      Number.isFinite(upperBound) ? upperBound : startSeconds + nextPosition,
      Math.max(startSeconds, startSeconds + nextPosition)
    );
    audio.currentTime = nextTime;
    setCurrentSeconds(nextTime);
  }

  function skipBy(deltaSeconds: number) {
    seekToSegmentPosition(segmentPosition + deltaSeconds);
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
          setCurrentSeconds(startSeconds);
          activeSentenceRef.current = null;
          onActiveSentenceChange?.(null);
        }}
        onPause={() => setIsPlaying(false)}
        onLoadedMetadata={(event) => {
          const audio = event.currentTarget;
          setLoadedDuration(Number.isFinite(audio.duration) ? audio.duration : null);
          if (audio.currentTime < startSeconds) {
            audio.currentTime = startSeconds;
          }
          setCurrentSeconds(audio.currentTime);
        }}
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="app-kicker token-text-muted">Read + Listen</div>
          <div className="text-xs font-semibold tabular-nums token-text-secondary">
            {formatAudioTime(segmentPosition)} / {formatAudioTime(segmentDuration)}
          </div>
        </div>

        <input
          type="range"
          min={0}
          max={Math.max(segmentDuration, 1)}
          step={0.25}
          value={segmentPosition}
          onChange={(event) => seekToSegmentPosition(Number(event.target.value))}
          disabled={segmentDuration <= 0}
          aria-label="Audio position"
          className="h-6 w-full cursor-pointer accent-[var(--color-primary)] disabled:cursor-wait"
        />

        <div className="grid grid-cols-[44px_minmax(0,1fr)_44px_auto] items-center gap-2">
          <button
            type="button"
            onClick={() => skipBy(-15)}
            aria-label="Back 15 seconds"
            title="Back 15 seconds"
            className="secondary-button min-h-11 w-11 px-0"
          >
            <RewindIcon />
          </button>
          <button
            type="button"
            onClick={() => (isPlaying ? pausePlayback() : void startPlayback())}
            aria-label={isPlaying ? "Pause audio" : "Play audio"}
            title={isPlaying ? "Pause audio" : "Play audio"}
            className="primary-button min-h-11 min-w-0 gap-2 px-3"
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
            <span>{isPlaying ? "Pause" : "Play"}</span>
          </button>
          <button
            type="button"
            onClick={() => skipBy(15)}
            aria-label="Forward 15 seconds"
            title="Forward 15 seconds"
            className="secondary-button min-h-11 w-11 px-0"
          >
            <ForwardIcon />
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
