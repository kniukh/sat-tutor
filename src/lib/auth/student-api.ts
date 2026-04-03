import "server-only";

import { getStudentSession } from "@/lib/auth/student";

export class StudentApiAuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "StudentApiAuthError";
    this.status = status;
  }
}

export async function requireStudentApiSession(expectedStudentId?: string | null) {
  const session = await getStudentSession();

  if (!session) {
    throw new StudentApiAuthError("Unauthorized", 401);
  }

  if (expectedStudentId && expectedStudentId !== session.studentId) {
    console.warn("Student API received stale studentId from client body", {
      expectedStudentId,
      sessionStudentId: session.studentId,
    });
  }

  return session;
}

export async function requireStudentApiStudentId(expectedStudentId?: string | null) {
  const session = await requireStudentApiSession(expectedStudentId);
  return session.studentId;
}

export function isStudentApiAuthError(error: unknown): error is StudentApiAuthError {
  return error instanceof StudentApiAuthError;
}
