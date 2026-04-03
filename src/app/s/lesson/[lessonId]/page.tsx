import { redirect } from "next/navigation";

import { requireStudentSession } from "@/lib/auth/student";
import { buildSessionBackedStudentPath } from "@/lib/routes/student-session-path";

export default async function CanonicalStudentLessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const [session, { lessonId }] = await Promise.all([requireStudentSession(), params]);
  redirect(buildSessionBackedStudentPath(session.accessCode, `/lesson/${lessonId}`));
}
