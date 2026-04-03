export const STUDENT_SESSION_COOKIE = "sat_student_session";

export type StudentSessionPayload = {
  studentId: string;
  accessCode: string;
  fullName: string;
  issuedAt: number;
};

function getStudentSessionSecret() {
  return process.env.STUDENT_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function encodePayload(payload: StudentSessionPayload) {
  return encodeURIComponent(JSON.stringify(payload));
}

function decodePayload(value: string) {
  return JSON.parse(decodeURIComponent(value)) as StudentSessionPayload;
}

async function signValue(value: string) {
  const secret = getStudentSessionSecret();

  if (!secret) {
    throw new Error("Missing student session secret");
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function createStudentSessionToken(payload: Omit<StudentSessionPayload, "issuedAt">) {
  const sessionPayload: StudentSessionPayload = {
    ...payload,
    issuedAt: Date.now(),
  };
  const encodedPayload = encodePayload(sessionPayload);
  const signature = await signValue(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export async function verifyStudentSessionToken(token: string | null | undefined) {
  if (!token) {
    return null;
  }

  const separatorIndex = token.lastIndexOf(".");

  if (separatorIndex <= 0) {
    return null;
  }

  const encodedPayload = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  const expectedSignature = await signValue(encodedPayload);

  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const payload = decodePayload(encodedPayload);

    if (!payload.studentId || !payload.accessCode || !payload.fullName) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
