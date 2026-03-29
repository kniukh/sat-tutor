"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  getExerciseAudioStatus,
  getExerciseAudioUrl,
  type ListenMatchVocabExercise,
  type SpellingFromAudioVocabExercise,
} from "@/types/vocab-exercises";
import ExercisePromptPanel from "./ExercisePromptPanel";

type AudioUiState = "idle" | "loading" | "ready" | "replay" | "error";

type Props = {
  exercise: ListenMatchVocabExercise | SpellingFromAudioVocabExercise;
  title: string;
  description: string;
  readyHint: string;
  fallbackContent: ReactNode;
  footer: ReactNode;
};

export default function AudioExercisePrompt({
  exercise,
  title,
  description,
  readyHint,
  fallbackContent,
  footer,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const shouldAutoplayRef = useRef(false);
  const [audioState, setAudioState] = useState<AudioUiState>("idle");
  const [audioError, setAudioError] = useState<string | null>(null);

  const audioUrl = getExerciseAudioUrl(exercise);
  const audioStatus = getExerciseAudioStatus(exercise);
  const hasAudio = Boolean(audioUrl) && audioStatus !== "failed" && audioStatus !== "missing";

  useEffect(() => {
    setAudioState(hasAudio ? "idle" : "error");
    setAudioError(
      hasAudio
        ? null
        : audioStatus === "pending"
          ? "Audio is still being prepared for this item."
          : "Audio is unavailable for this exercise."
    );
    shouldAutoplayRef.current = false;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [audioStatus, audioUrl, exercise.id, hasAudio]);

  async function handlePlay() {
    if (!audioRef.current || !audioUrl) {
      setAudioState("error");
      setAudioError("Audio is unavailable for this exercise.");
      return;
    }

    if (audioState === "ready" || audioState === "replay") {
      try {
        await audioRef.current.play();
        setAudioState("replay");
      } catch (error) {
        console.error("audio exercise play error", error);
        setAudioState("error");
        setAudioError("The audio could not be played in this browser.");
      }
      return;
    }

    shouldAutoplayRef.current = true;
    setAudioState("loading");
    setAudioError(null);
    audioRef.current.load();
  }

  return (
    <ExercisePromptPanel
      eyebrow={exercise.prompt}
      title={title}
      body={
        <div className="space-y-4">
          <div className="rounded-[24px] border border-slate-200 bg-slate-950 p-5 text-white shadow-[0_18px_35px_-24px_rgba(15,23,42,0.85)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  Audio Prompt
                </div>
                <div className="mt-2 text-sm leading-6 text-white/75">{description}</div>
              </div>
              <button
                type="button"
                onClick={handlePlay}
                disabled={!hasAudio}
                className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  hasAudio
                    ? "bg-white text-slate-950 hover:bg-slate-100"
                    : "cursor-not-allowed bg-white/10 text-white/45"
                }`}
              >
                {audioState === "loading"
                  ? "Loading..."
                  : audioState === "replay"
                    ? "Replay Audio"
                    : "Play Audio"}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75">
                {audioState === "error"
                  ? "Unavailable"
                  : audioState === "loading"
                    ? "Loading"
                    : audioState === "replay"
                      ? "Replay Ready"
                      : audioState === "ready"
                        ? "Ready"
                        : "Idle"}
              </span>
              {audioStatus ? (
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
                  source {audioStatus}
                </span>
              ) : null}
            </div>
          </div>

          {hasAudio ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              {readyHint}
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              <div className="font-semibold">Audio fallback</div>
              <div className="mt-2">{audioError ?? "Audio is unavailable for this exercise."}</div>
              <div className="mt-3 rounded-xl border border-amber-200 bg-white px-3 py-3 text-slate-800">
                {fallbackContent}
              </div>
            </div>
          )}

          <audio
            ref={audioRef}
            preload="none"
            src={audioUrl ?? undefined}
            onCanPlay={async () => {
              setAudioState((current) => (current === "replay" ? current : "ready"));

              if (shouldAutoplayRef.current && audioRef.current) {
                shouldAutoplayRef.current = false;
                try {
                  await audioRef.current.play();
                  setAudioState("replay");
                } catch (error) {
                  console.error("audio exercise autoplay error", error);
                  setAudioState("error");
                  setAudioError("The audio loaded but playback was blocked.");
                }
              }
            }}
            onEnded={() => setAudioState("replay")}
            onError={() => {
              shouldAutoplayRef.current = false;
              setAudioState("error");
              setAudioError("The audio file could not be loaded.");
            }}
            hidden
          />
        </div>
      }
      footer={footer}
    />
  );
}
