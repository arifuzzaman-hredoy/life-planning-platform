import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
vi.mock("@/lib/db", () => ({ db: {} }));
import { assertOrigin } from "@/lib/auth";
import { failure, readJson } from "@/lib/http";
import { ApiError } from "@/lib/errors";
import { serializeRecord, publicUser } from "@/lib/serialize";

beforeEach(() => vi.stubEnv("APP_URL", "https://planner.example.com"));
describe("HTTP boundary", () => {
  it("rejects absent/foreign origins and disguised JSON content types", () => {
    const request = (headers: Record<string, string>) =>
      new Request("https://planner.example.com/api/entries", { method: "POST", headers });
    expect(() => assertOrigin(request({}))).toThrow("origin");
    expect(() =>
      assertOrigin(
        request({ origin: "https://attacker.example", "content-type": "application/json" }),
      ),
    ).toThrow("origin");
    expect(() =>
      assertOrigin(
        request({ origin: "https://planner.example.com", "content-type": "application/jsonx" }),
      ),
    ).toThrow("application/json");
    expect(() =>
      assertOrigin(
        request({
          origin: "https://planner.example.com",
          "content-type": "application/json; charset=UTF-8",
        }),
      ),
    ).not.toThrow();
  });
  it("checks actual body size even without Content-Length", async () => {
    const request = new Request("https://planner.example.com", {
      method: "POST",
      body: JSON.stringify({ text: "x".repeat(131072) }),
    });
    await expect(readJson(request, z.object({ text: z.string() }))).rejects.toMatchObject({
      status: 413,
    });
    await expect(
      readJson(
        new Request("https://planner.example.com", { method: "POST", body: "{" }),
        z.object({}),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("returns safe structured errors without stack traces", async () => {
    expect(failure(new ApiError(404, "Not found")).status).toBe(404);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = failure(new Error("private internal database detail"));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("private");
    log.mockRestore();
  });
  it("excludes ownership and secret fields from API records", () => {
    expect(
      serializeRecord({
        id: "1",
        userId: "owner",
        passwordHash: "secret",
        tokenHash: "token",
        recurrenceSourceId: "original",
        createdAt: new Date("2026-09-07T00:00:00Z"),
        amount: { toNumber: () => 12.5 },
      }),
    ).toEqual({ id: "1", createdAt: "2026-09-07T00:00:00.000Z", amount: 12.5 });
    expect(
      publicUser({
        id: "1",
        name: "Owner",
        email: "owner@example.invalid",
        currency: "BDT",
        timezone: "Asia/Dhaka",
        mustChangePassword: true,
      }),
    ).not.toHaveProperty("passwordHash");
  });
});
