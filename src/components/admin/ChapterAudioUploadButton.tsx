"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  sourceDocumentId: string;
  chapterIndex: number;
  chapterTitle: string | null;
  audioUrl?: string | null;
  audioStatus?: string | null;
  sentenceCount?: number;
};

function formatStatus(status?: string | null, sentenceCount?: number) {
  if (!status || status === "missing") {
    return "No audio";
  }

  const sentenceLabel =
    typeof sentenceCount === "number" && sentenceCount > 0
      ? ` · ${sentenceCount} sentences`
      : "";

  if (status === "aligned_estimated") {
    return `Estimated alignment${sentenceLabel}`;
  }

  if (status === "aligned_stt") {
    return `STT alignment${sentenceLabel}`;
  }

  if (status === "sentences_ready") {
    return `Sentences ready${sentenceLabel}`;
  }

  return `${status}${sentenceLabel}`;
}

function readAudioDurationMs(file: File) {
  return new Promise<number | null>((resolve) => {
    const audio = document.createElement("audio");
    const objectUrl = URL.createObjectURL(file);

    audio.preload = "metadata";
    audio.src = objectUrl;
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration)
        ? Math.round(audio.duration * 1000)
        : null;
      URL.revokeObjectURL(objectUrl);
      resolve(duration);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
  });
}

export default function ChapterAudioUploadButton({
  sourceDocumentId,
  chapterIndex,
  chapterTitle,
  audioUrl,
  audioStatus,
  sentenceCount,
}: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function uploadFile(file: File) {
    setError(null);

    startTransition(async () => {
      const durationMs = await readAudioDurationMs(file);
      const formData = new FormData();
      formData.append("sourceDocumentId", sourceDocumentId);
      formData.append("chapterIndex", String(chapterIndex));
      if (durationMs) {
        formData.append("durationMs", String(durationMs));
      }
      // Next's multipart parser can reject non-ASCII filenames. Keep the original
      // bytes but send an ASCII filename in Content-Disposition.
      const extension = file.name.match(/\.[a-z0-9]+$/i)?.[0].toLowerCase() ?? ".mp3";
      formData.append(
        "audioFile",
        file,
        `chapter-${chapterIndex}${extension}`,
      );

      const response = await fetch("/api/admin/sources/chapter-audio", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(
          payload?.error ??
            `Upload failed (${response.status}). Please try again.`,
        );
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="surface-soft-panel space-y-3 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="app-kicker token-text-muted">
            Chapter Audio
          </div>
          <div className="token-text-primary mt-1 font-semibold">
            {chapterTitle || `Chapter ${chapterIndex}`}
          </div>
          <div className="token-text-secondary mt-1 text-sm">
            {formatStatus(audioStatus, sentenceCount)}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {audioUrl ? (
            <audio src={audioUrl} controls preload="none" className="h-10 max-w-48" />
          ) : null}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isPending}
            className="secondary-button min-h-10 disabled:opacity-50"
          >
            {isPending ? "Uploading..." : audioUrl ? "Replace Audio" : "Upload Audio"}
          </button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          event.target.value = "";
          if (file) {
            uploadFile(file);
          }
        }}
      />

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
