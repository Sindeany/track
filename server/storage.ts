import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const uploadRoot = path.resolve(process.env.UPLOAD_DIR || "uploads");

function safeKey(relKey: string) {
  const normalized = relKey.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..")) throw new Error("Invalid storage key");
  return normalized;
}

function uniqueKey(relKey: string) {
  const clean = safeKey(relKey);
  const ext = path.extname(clean);
  const stem = ext ? clean.slice(0, -ext.length) : clean;
  return `${stem}_${crypto.randomBytes(4).toString("hex")}${ext}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = uniqueKey(relKey);
  const target = path.join(uploadRoot, key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, data);
  return { key, url: `/uploads/${key}` };
}

export async function storageGet(relKey: string) {
  const key = safeKey(relKey);
  return { key, url: `/uploads/${key}` };
}

export async function storageGetSignedUrl(relKey: string) {
  return (await storageGet(relKey)).url;
}
