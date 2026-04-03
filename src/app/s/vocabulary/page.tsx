import { redirect } from "next/navigation";

import { requireStudentSession } from "@/lib/auth/student";
import { buildSessionBackedStudentPath } from "@/lib/routes/student-session-path";

export default async function CanonicalStudentVocabularyPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; phase?: string; lesson?: string }>;
}) {
  const [session, resolvedSearchParams] = await Promise.all([requireStudentSession(), searchParams]);
  redirect(
    buildSessionBackedStudentPath(session.accessCode, "/vocabulary", {
      mode: resolvedSearchParams.mode,
      phase: resolvedSearchParams.phase,
      lesson: resolvedSearchParams.lesson,
    })
  );
}
