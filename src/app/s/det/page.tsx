import { redirect } from "next/navigation";

import { requireStudentSession } from "@/lib/auth/student";
import { buildSessionBackedStudentPath } from "@/lib/routes/student-session-path";

export default async function DetReadingEntryPage() {
  const session = await requireStudentSession();
  redirect(`${buildSessionBackedStudentPath(session.accessCode, "/book")}?mode=det`);
}
