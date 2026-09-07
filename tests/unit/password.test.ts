import { afterEach, describe, expect, it, vi } from "vitest";
import { hashPassword, hashToken, newSessionToken, verifyPassword } from "@/lib/password";

afterEach(() => vi.unstubAllEnvs());
describe("password and session security", () => {
  it("salts password hashes and verifies them without storing the password", async () => {
    const password = "Only a generated test password 123!";
    const first = await hashPassword(password);
    const second = await hashPassword(password);
    expect(first).not.toBe(second);
    expect(first).not.toContain(password);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword("incorrect", first)).toBe(false);
    expect(await verifyPassword(password, first + "$extra")).toBe(false);
    expect(await verifyPassword(password, "broken")).toBe(false);
  });
  it("generates random 256-bit tokens and stores keyed digests", () => {
    vi.stubEnv("SESSION_SECRET", "test-secret-which-is-at-least-32-characters");
    const first = newSessionToken();
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toBe(newSessionToken());
    expect(hashToken(first)).toMatch(/^[a-f0-9]{64}$/);
    const original = hashToken(first);
    vi.stubEnv("SESSION_SECRET", "different-secret-with-at-least-32-characters");
    expect(hashToken(first)).not.toBe(original);
    vi.stubEnv("SESSION_SECRET", "short");
    expect(() => hashToken(first)).toThrow("SESSION_SECRET");
  });
});
