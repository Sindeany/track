import crypto from "node:crypto";
import { SESSION_TTL_MS } from "@shared/const";
import { getCookieSecret } from "./env";

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

export function verifyPassword(password: string, combined: string | null | undefined): boolean {
  if (!combined || typeof combined !== "string") return false;
  const parts = combined.split(":");
  if (parts.length !== 2) return false;
  const [salt, key] = parts;
  if (!salt || !key) return false;

  try {
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = crypto.scryptSync(password, salt, 64);
    if (keyBuffer.length !== derivedKey.length) return false;
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

export type SessionPayload = {
  userId: number;
  role: "user" | "admin";
  sv: number;
  exp: number;
};

export function createSessionToken(
  params: { userId: number; role: "user" | "admin"; sessionVersion?: number },
  secret: string = getCookieSecret(),
  expiresInMs: number = SESSION_TTL_MS,
): string {
  const payload: SessionPayload = {
    userId: params.userId,
    role: params.role,
    sv: params.sessionVersion ?? 0,
    exp: Date.now() + expiresInMs,
  };

  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payloadEncoded)
    .digest("base64url");

  return `${payloadEncoded}.${signature}`;
}

export function verifySessionToken(
  token: string | null | undefined,
  secret: string = getCookieSecret(),
): SessionPayload | null {
  if (!token || typeof token !== "string") return null;
  const [payloadEncoded, signature] = token.split(".");
  if (!payloadEncoded || !signature) return null;

  try {
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payloadEncoded)
      .digest("base64url");

    const expectedBuffer = Buffer.from(expectedSignature);
    const signatureBuffer = Buffer.from(signature);

    if (expectedBuffer.length !== signatureBuffer.length) return null;
    if (!crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) return null;

    const payloadText = Buffer.from(payloadEncoded, "base64url").toString("utf8");
    const payload = JSON.parse(payloadText) as SessionPayload;

    if (!payload.userId || !payload.exp || typeof payload.exp !== "number") return null;
    if (typeof payload.sv !== "number" || !Number.isInteger(payload.sv) || payload.sv < 0) return null;
    if (Date.now() > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}
