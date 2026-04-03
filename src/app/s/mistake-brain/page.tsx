import { redirect } from "next/navigation";

import { requireStudentSession } from "@/lib/auth/student";
import { buildSessionBackedStudentPath } from "@/lib/routes/student-session-path";

export default async function CanonicalStudentMistakeBrainPage() {
  const session = await requireStudentSession();
  redirect(buildSessionBackedStudentPath(session.accessCode, "/mistake-brain"));
}
