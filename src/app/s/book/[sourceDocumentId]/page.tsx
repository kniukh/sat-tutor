import { redirect } from "next/navigation";

import { requireStudentSession } from "@/lib/auth/student";
import { buildSessionBackedStudentPath } from "@/lib/routes/student-session-path";

export default async function CanonicalStudentBookDetailPage({
  params,
}: {
  params: Promise<{ sourceDocumentId: string }>;
}) {
  const [session, { sourceDocumentId }] = await Promise.all([requireStudentSession(), params]);
  redirect(buildSessionBackedStudentPath(session.accessCode, `/book/${sourceDocumentId}`));
}
