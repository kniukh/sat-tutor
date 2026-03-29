"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  studentId: string;
  lessonId: string | null;
  lessonName: string | null;
  pendingCount: number;
  readyCount: number;
};

type PrefetchState = "idle" | "preparing" | "ready" | "error";

export default function VocabularyAudioPrefetch({
  studentId,
  lessonId,
  lessonName,
  pendingCount,
  readyCount,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<PrefetchState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!lessonId || pendingCount <= 0) {
      return;
    }

    const storageKey = `vocab-audio-prefetch:${studentId}:${lessonId}`;

    try {
      if (window.sessionStorage.getItem(storageKey)) {
        setStatus("ready");
        setMessage("Audio preparation was already triggered in this tab.");
        return;
      }
      window.sessionStorage.setItem(storageKey, "requested");
    } catch {
      // sessionStorage can fail in strict environments; continue without caching.
    }

    startTransition(async () => {
      try {
        setStatus("preparing");
        setMessage("Preparing audio in the background so listen exercises can join future sessions.");

        const response = await fetch("/api/vocabulary/generate-audio-bulk", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ studentId, lessonId }),
        });

        if (!response.ok) {
          setStatus("error");
          setMessage("Audio preparation could not be completed right now.");
          return;
        }

        setStatus("ready");
        setMessage("Audio preparation finished. Refreshing your vocabulary studio...");
        router.refresh();
      } catch (error) {
        console.error("vocabulary audio prefetch error", error);
        setStatus("error");
        setMessage("Audio preparation is temporarily unavailable.");
      }
    });
  }, [lessonId, pendingCount, router, studentId]);

  if (!lessonId) {
    return (
      <div className="rounded-[24px] border border-slate-200 bg-white p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Listen Match
        </div>
        <div className="mt-2 text-sm leading-6 text-slate-600">
          {readyCount > 0
            ? `${readyCount} audio-ready words are already available for listen-based exercises.`
            : "No audio-ready words are available yet."}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Audio Preparation
          </div>
          <div className="mt-2 text-sm font-semibold text-slate-950">
            {lessonName ?? "Recent lesson"} is being prepared for listen-based review
          </div>
        </div>
        <div
          className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
            status === "error"
              ? "border border-rose-200 bg-rose-50 text-rose-700"
              : status === "ready"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : status === "preparing"
                  ? "border border-blue-200 bg-blue-50 text-blue-700"
                  : "border border-slate-200 bg-slate-50 text-slate-600"
          }`}
        >
          {status}
        </div>
      </div>

      <div className="mt-3 text-sm leading-6 text-slate-600">
        {message ??
          `${pendingCount} items still need audio before they can reliably appear as listen-match exercises.`}
      </div>
    </div>
  );
}
