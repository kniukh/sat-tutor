import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  createStudentSessionToken,
  STUDENT_SESSION_COOKIE,
  type StudentSessionPayload,
  verifyStudentSessionToken,
} from "@/lib/auth/student-session";

const STUDENT_SESSION_MAX_AGE = 60 * 60 * 24 * 14;

export async function loginStudentSession(input: {
  studentId: string;
  accessCode: string;
  fullName: string;
}) {
  const cookieStore = await cookies();
  const token = await createStudentSessionToken(input);

  cookieStore.set(STUDENT_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STUDENT_SESSION_MAX_AGE,
  });
}

export async function logoutStudentSession() {
  const cookieStore = await cookies();
  cookieStore.set(STUDENT_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getStudentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(STUDENT_SESSION_COOKIE)?.value;
  return verifyStudentSessionToken(token);
}

export async function requireStudentSession(): Promise<StudentSessionPayload> {
  const session = await getStudentSession();

  if (!session) {
    redirect("/student/login");
  }

  return session;
}
