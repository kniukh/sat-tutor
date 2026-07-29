export const ADMIN_SESSION_COOKIE = "sat_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

type AdminSessionPayload = {
  role: "admin";
  exp: number;
};

function getSigningSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_LOGIN_PASSWORD;

  if (!secret) {
    throw new Error("Missing ADMIN_SESSION_SECRET or ADMIN_LOGIN_PASSWORD");
  }

  return secret;
}

function encodeBase64Url(value: Uint8Array) {
  let binary = "";
  for (const byte of value) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function encodePayload(payload: AdminSessionPayload) {
  return encodeBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

function decodePayload(value: string): AdminSessionPayload | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as AdminSessionPayload;
  } catch {
    return null;
  }
}

async function getSigningKey() {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSigningSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createAdminSessionToken() {
  const payload = encodePayload({
    role: "admin",
    exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE_SECONDS,
  });
  const signature = await crypto.subtle.sign(
    "HMAC",
    await getSigningKey(),
    new TextEncoder().encode(payload)
  );

  return `${payload}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export async function verifyAdminSessionToken(token: string | undefined) {
  if (!token) return false;

  const [payloadPart, signaturePart, extraPart] = token.split(".");
  if (!payloadPart || !signaturePart || extraPart) return false;

  const payload = decodePayload(payloadPart);
  if (
    !payload ||
    payload.role !== "admin" ||
    !Number.isFinite(payload.exp) ||
    payload.exp <= Math.floor(Date.now() / 1000)
  ) {
    return false;
  }

  try {
    const normalized = signaturePart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    const signature = Uint8Array.from(binary, (character) => character.charCodeAt(0));

    return crypto.subtle.verify(
      "HMAC",
      await getSigningKey(),
      signature,
      new TextEncoder().encode(payloadPart)
    );
  } catch {
    return false;
  }
}
