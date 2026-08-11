import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  exchangeCode: vi.fn(),
  clearTransient: vi.fn(),
  auditAuth: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: mocks.cookieGet })),
}));

vi.mock("@/lib/auth", () => ({
  AccountLinkError: class AccountLinkError extends Error {
    constructor(public issue: string) { super(issue); }
  },
  LegacyAccountLinkRequiredError: class LegacyAccountLinkRequiredError extends Error {},
  createSessionRecord: vi.fn(),
  deleteCurrentSession: vi.fn(),
  getCurrentUser: vi.fn(),
  resolveOidcUser: vi.fn(),
  setSessionResponseCookie: vi.fn(),
}));

vi.mock("@/lib/authAudit", () => ({ auditAuth: mocks.auditAuth }));

vi.mock("@/lib/oidcCookies", () => ({
  clearTransientOidcCookies: mocks.clearTransient,
  setTokenCookies: vi.fn(),
}));

vi.mock("@/lib/oidc", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/oidc")>();
  return { ...actual, exchangeCode: mocks.exchangeCode };
});

import { GET } from "@/app/api/auth/callback/route";
import { NextRequest } from "next/server";

describe("Experts OIDC callback replay protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.COGNITO_ISSUER = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_example";
    process.env.COGNITO_DOMAIN = "https://auth.thesyncforge.com";
    process.env.COGNITO_CLIENT_ID = "experts-client";
    process.env.NEXT_PUBLIC_APP_URL = "https://experts.thesyncforge.com";
  });

  it("rejects a callback after its one-time state cookie has been consumed", async () => {
    mocks.cookieGet.mockReturnValue(undefined);
    const response = await GET(new NextRequest(
      "https://experts.thesyncforge.com/api/auth/callback?code=replayed&state=old-state",
    ));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/sign-in?error=");
    expect(mocks.exchangeCode).not.toHaveBeenCalled();
    expect(mocks.clearTransient).toHaveBeenCalledOnce();
    expect(mocks.auditAuth).toHaveBeenCalledWith(
      "oidc.callback",
      "failure",
      "invalid_state",
      { intent: "signin" },
    );
  });
});
