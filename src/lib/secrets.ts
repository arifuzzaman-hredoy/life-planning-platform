import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
function encryptionKey() {
  const secret = process.env.AI_ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("Encryption key is not configured");
  return createHash("sha256")
    .update("life-planning-ai-v1:" + secret)
    .digest();
}
export function encryptSecret(value: string, ownerId: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv, { authTagLength: 16 });
  cipher.setAAD(Buffer.from(ownerId));
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}
export function decryptSecret(value: string, ownerId: string) {
  const [version, iv, tag, body] = value.split(".");
  if (version !== "v1" || !iv || !tag || !body) throw new Error("Invalid encrypted value");
  const authTag = Buffer.from(tag, "base64");
  if (authTag.length !== 16) throw new Error("Invalid encrypted value");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"), {
    authTagLength: 16,
  });
  decipher.setAAD(Buffer.from(ownerId));
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]).toString(
    "utf8",
  );
}
