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

  void lessonName;
  void readyCount;
  void status;
  void message;

  return null;
}
