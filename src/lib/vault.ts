import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { ApiError } from "./errors";
import { vaultMetadataSchema } from "./feature-validation";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_VAULT_BYTES = 250 * 1024 * 1024;
export const fileSelect = {
  id: true,
  title: true,
  description: true,
  category: true,
  fileType: true,
  subjects: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  sha256: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.VaultFileSelect;

export function detectedMime(bytes: Buffer, name: string) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (/^GIF8[79]a/.test(bytes.subarray(0, 6).toString())) return "image/gif";
  if (bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP")
    return "image/webp";
  if (bytes.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  if (
    /\.(txt|md|csv|json|html?|css|[cm]?js|jsx|tsx?|py|ya?ml|xml|sql|sh|tf|log)$/i.test(name) &&
    !bytes.includes(0)
  )
    return "text/plain";
  return "application/octet-stream";
}
export async function boundedFormData(request: Request) {
  const maximum = MAX_UPLOAD_BYTES + 65536;
  if (Number(request.headers.get("content-length") ?? 0) > maximum)
    throw new ApiError(413, "Upload limit is 25 MB per file");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "Choose a file to upload");
  let length = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maximum) {
      await reader.cancel();
      throw new ApiError(413, "Upload limit is 25 MB per file");
    }
    chunks.push(value);
  }
  try {
    return await new Response(Buffer.concat(chunks), {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    throw new ApiError(400, "Invalid file upload");
  }
}
export async function uploadFile(userId: string, file: File, raw: unknown) {
  const metadata = vaultMetadataSchema.parse(raw);
  if (!file.size || file.size > MAX_UPLOAD_BYTES)
    throw new ApiError(413, "Choose a non-empty file up to 25 MB");
  const content = Buffer.from(await file.arrayBuffer());
  const originalName = file.name.replace(/[\r\n\u0000/\\]/g, "_").slice(0, 200) || "upload.bin";
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"vault:" + userId}))`;
    const usage = await tx.vaultFile.aggregate({ where: { userId }, _sum: { sizeBytes: true } });
    if ((usage._sum.sizeBytes ?? 0) + content.length > MAX_VAULT_BYTES)
      throw new ApiError(413, "Vault storage limit is 250 MB. Remove unneeded uploads first.");
    return tx.vaultFile.create({
      data: {
        ...metadata,
        userId,
        content,
        originalName,
        sizeBytes: content.length,
        mimeType: detectedMime(content, originalName),
        sha256: createHash("sha256").update(content).digest("hex"),
      },
      select: fileSelect,
    });
  });
}
