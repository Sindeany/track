import crypto from "node:crypto";
import { ENV } from "./env";

const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30;

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
  exp: number;
};

export function createSessionToken(
  params: { userId: number; role: "user" | "admin" },
  secret: string = ENV.cookieSecret || "field-visits-default-secret",
  expiresInMs: number = THIRTY_DAYS_MS,
): string {
  const payload: SessionPayload = {
    userId: params.userId,
    role: params.role,
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
  secret: string = ENV.cookieSecret || "field-visits-default-secret",
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
    if (Date.now() > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}
