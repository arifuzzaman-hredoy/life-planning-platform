import { db } from "@/lib/db";
import { authenticated, success } from "@/lib/http";
import {
  boundedFormData,
  fileSelect,
  uploadFile,
  MAX_VAULT_BYTES,
  MAX_UPLOAD_BYTES,
} from "@/lib/vault";
import { ApiError } from "@/lib/errors";
export const GET = authenticated(async (_request, user) => {
  const files = await db.vaultFile.findMany({
    where: { userId: user.id },
    select: fileSelect,
    orderBy: { createdAt: "desc" },
  });
  return success({
    files,
    usedBytes: files.reduce((sum, file) => sum + file.sizeBytes, 0),
    maxBytes: MAX_VAULT_BYTES,
    maxUploadBytes: MAX_UPLOAD_BYTES,
  });
});
export const POST = authenticated(
  async (request, user) => {
    const form = await boundedFormData(request);
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "File is required");
    let subjects: unknown = [];
    try {
      subjects = JSON.parse(String(form.get("subjects") ?? "[]"));
    } catch {
      throw new ApiError(400, "Invalid subject list");
    }
    return success(
      await uploadFile(user.id, file, {
        title: String(form.get("title") || file.name),
        description: String(form.get("description") ?? ""),
        category: String(form.get("category") ?? ""),
        fileType: String(form.get("fileType") ?? "document"),
        subjects,
      }),
      201,
    );
  },
  false,
  "multipart/form-data",
);
