import { revokeSession, assertOrigin } from "@/lib/auth";
import { failure, success } from "@/lib/http";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    await revokeSession();
    return success({ signedOut: true });
  } catch (error) {
    return failure(error);
  }
}
