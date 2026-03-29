"use client";

export default function ResetLessonButton({
  studentId,
  lessonId,
}: {
  studentId: string;
  lessonId: string;
}) {
  async function handleReset() {
    const ok = window.confirm("Reset this lesson for this student?");
    if (!ok) return;

    const response = await fetch("/api/lesson/reset", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ studentId, lessonId }),
    });

    if (!response.ok) {
      alert("Failed to reset lesson");
      return;
    }

    window.location.reload();
  }

  return (
    <button
      onClick={handleReset}
      className="px-4 py-2 rounded-lg border border-red-300 text-red-700 bg-red-50"
    >
      Reset Lesson
    </button>
  );
}