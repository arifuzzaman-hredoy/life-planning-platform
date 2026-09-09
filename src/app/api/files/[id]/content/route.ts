import { db } from "@/lib/db";
import { authenticated } from "@/lib/http";
import { ApiError } from "@/lib/errors";
export const GET = authenticated(async (request, user, context) => {
  const { id } = await context.params;
  const file = await db.vaultFile.findFirst({ where: { id, userId: user.id } });
  if (!file) throw new ApiError(404, "File not found");
  const download =
    new URL(request.url).searchParams.get("download") === "1" ||
    file.mimeType === "application/octet-stream";
  return new Response(Buffer.from(file.content), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.sizeBytes),
      "Cache-Control": "private, no-store",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="download"; filename*=UTF-8''${encodeURIComponent(file.originalName).replace(/'/g, "%27")}`,
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "Content-Security-Policy":
        "sandbox; default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'",
    },
  });
});
