"use client";

export default function RegenerateAudioButton({
  studentId,
  lessonId,
}: {
  studentId: string;
  lessonId: string;
}) {
  async function handleRegenerate() {
    const response = await fetch("/api/vocabulary/regenerate-audio", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ studentId, lessonId }),
    });

    if (!response.ok) {
      alert("Failed to regenerate audio");
      return;
    }

    window.location.reload();
  }

  return (
    <button
      onClick={handleRegenerate}
      className="px-4 py-2 rounded-lg border border-blue-300 text-blue-700 bg-blue-50"
    >
      Regenerate Audio
    </button>
  );
}