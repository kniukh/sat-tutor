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
          <button
            type="button"
            onClick={handlePlay}
            disabled={!hasAudio}
            className={`inline-flex min-h-14 w-full items-center justify-center rounded-2xl px-4 py-4 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
              hasAudio
                ? "bg-slate-950 text-white hover:bg-slate-800"
                : "cursor-not-allowed bg-slate-200 text-slate-500"
            }`}
          >
            {audioState === "loading"
              ? "Loading..."
              : audioState === "replay"
                ? "Replay"
                : "Play audio"}
          </button>

          {hasAudio ? (
            <div className="text-sm text-slate-500">{description || readyHint}</div>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              <div>{audioError ?? "Audio is unavailable for this exercise."}</div>
              <div className="mt-3 text-slate-700">{fallbackContent}</div>
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
      footer={hasAudio ? null : footer}
    />
  );
}
