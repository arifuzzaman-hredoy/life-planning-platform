import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { assertOrigin, requireUser } from "./auth";
import { ApiError } from "./errors";
import { observeHttpRequest } from "./metrics";
type User = Awaited<ReturnType<typeof requireUser>>;
export type RouteContext = { params: Promise<Record<string, string>> };
export function success(data: unknown, status = 200) {
  return NextResponse.json({ data }, { status, headers: { "Cache-Control": "no-store" } });
}
function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}
export function failure(error: unknown) {
  if (error instanceof ApiError) return errorResponse(error.message, error.status);
  if (error instanceof ZodError)
    return errorResponse(
      error.issues.map((i) => `${i.path.join(".") || "Input"}: ${i.message}`).join("; "),
      400,
    );
  if (error && typeof error === "object" && "code" in error) {
    if (error.code === "P2002") return errorResponse("A matching record already exists", 409);
    if (error.code === "P2025") return errorResponse("Record not found", 404);
  }
  console.error(
    JSON.stringify({
      level: "error",
      event: "api_request_failed",
      errorType: error instanceof Error ? error.name : "UnknownError",
      at: new Date().toISOString(),
    }),
  );
  return errorResponse("The request could not be completed. Please try again.", 500);
}
export async function readJson<T>(
  request: Request,
  schema: ZodType<T>,
  maximumBytes = 131072,
): Promise<T> {
  if (Number(request.headers.get("content-length") ?? 0) > maximumBytes)
    throw new ApiError(413, "Request is too large");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "Invalid JSON request");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maximumBytes) {
      await reader.cancel();
      throw new ApiError(413, "Request is too large");
    }
    chunks.push(value);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ApiError(400, "Invalid JSON request");
  }
  return schema.parse(body);
}
export function authenticated(
  handler: (request: Request, user: User, context: RouteContext) => Promise<Response>,
  allowPasswordChange = false,
  bodyType: "application/json" | "multipart/form-data" = "application/json",
) {
  return async (request: Request, context: RouteContext) => {
    const started = performance.now();
    let response: Response;
    try {
      assertOrigin(request, bodyType);
      const user = await requireUser();
      if (user.mustChangePassword && request.method !== "GET" && !allowPasswordChange)
        throw new ApiError(403, "Change your initial password before editing your workspace");
      response = await handler(request, user, context);
    } catch (error) {
      response = failure(error);
    }
    observeHttpRequest(request, response.status, (performance.now() - started) / 1000);
    return response;
  };
}
