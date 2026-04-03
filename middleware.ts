import { NextResponse, type NextRequest } from "next/server";

import {
  STUDENT_SESSION_COOKIE,
  verifyStudentSessionToken,
} from "@/lib/auth/student-session";

const CANONICAL_STUDENT_SEGMENTS = new Set([
  "book",
  "lesson",
  "vocabulary",
  "progress",
  "mistake-brain",
]);

function buildCanonicalStudentPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length <= 1) {
    return "/s";
  }

  if (CANONICAL_STUDENT_SEGMENTS.has(segments[1] ?? "")) {
    return pathname;
  }

  const rest = segments.slice(2);
  return rest.length > 0 ? `/s/${rest.join("/")}` : "/s";
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!pathname.startsWith("/s")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(STUDENT_SESSION_COOKIE)?.value;
  const session = await verifyStudentSessionToken(token);

  if (!session) {
    const loginUrl = new URL("/student/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 1) {
    const rewriteUrl = new URL(`/s/${session.accessCode}${search}`, request.url);
    return NextResponse.rewrite(rewriteUrl);
  }

  const firstStudentSegment = segments[1] ?? "";

  if (CANONICAL_STUDENT_SEGMENTS.has(firstStudentSegment)) {
    const suffix = pathname.slice("/s".length);
    const rewriteUrl = new URL(`/s/${session.accessCode}${suffix}${search}`, request.url);
    return NextResponse.rewrite(rewriteUrl);
  }

  const canonicalPath = buildCanonicalStudentPath(pathname);

  if (canonicalPath !== pathname) {
    const redirectUrl = new URL(`${canonicalPath}${search}`, request.url);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/s", "/s/:path*"],
};
