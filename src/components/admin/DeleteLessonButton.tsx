"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function DeleteLessonButton({
  lessonId,
  lessonName,
}: {
  lessonId: string;
  lessonName: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    const confirmed = window.confirm(
      `Delete "${lessonName}" from the database? This will remove its questions, passages, attempts, and lesson state.`
    );

    if (!confirmed) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const response = await fetch(`/api/admin/lessons?id=${lessonId}`, {
        method: "DELETE",
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.error ?? "Failed to delete lesson");
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="rounded-xl border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/35 dark:text-rose-300 dark:hover:bg-rose-500/10"
      >
        {isPending ? "Deleting..." : "Delete"}
      </button>
      {error ? <span className="ml-3 text-xs text-rose-600 dark:text-rose-300">{error}</span> : null}
    </div>
  );
}
