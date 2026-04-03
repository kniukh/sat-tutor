"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  tone?: "light" | "dark";
};

export default function StudentLogoutButton({ tone = "light" }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleLogout() {
    setError(null);

    try {
      const response = await fetch("/api/student/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error("Failed to logout");
      }

      startTransition(() => {
        router.push("/student/login");
        router.refresh();
      });
    } catch (logoutError) {
      console.error("student logout failed", logoutError);
      setError("Logout failed");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void handleLogout()}
        className={tone === "dark" ? "hero-link" : "secondary-button px-4 py-2 text-sm"}
        disabled={pending}
      >
        {pending ? "Signing out..." : "Logout"}
      </button>
      {error ? (
        <div className={tone === "dark" ? "text-xs text-white/70" : "token-text-muted text-xs"}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
