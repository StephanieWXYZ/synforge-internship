import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  OIDC_SCOPE,
  buildAuthorizeUrl,
  buildManagedLogoutUrl,
  exchangeCode,
  globalSignOut,
  isTrustedPostOrigin,
  normalizeReturnTo,
  refreshTokens,
  revokeRefreshToken,
  verifyIdToken,
  type OidcConfig,
} from "@/lib/oidc";

const config: OidcConfig = {
  issuer: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_example",
  domain: "https://auth.thesyncforge.com",
  clientId: "experts-client",
  appUrl: "https://experts.thesyncforge.com",
  callbackUrl: "https://experts.thesyncforge.com/api/auth/callback",
};

afterEach(() => vi.restoreAllMocks());

describe("Experts OIDC URL policy", () => {
  it("accepts only local non-auth return paths", () => {
    expect(normalizeReturnTo("/chatbots?view=mine")).toBe("/chatbots?view=mine");
    expect(normalizeReturnTo("https://evil.example/phish")).toBe("/");
    expect(normalizeReturnTo("//evil.example/phish")).toBe("/");
    expect(normalizeReturnTo("/\\evil.example")).toBe("/");
    expect(normalizeReturnTo("/api/auth/callback")).toBe("/");
  });

  it("builds authorization-code plus PKCE without offline_access", () => {
    const url = buildAuthorizeUrl(config, { state: "state", nonce: "nonce", challenge: "challenge" });
    expect(url.origin).toBe("https://auth.thesyncforge.com");
    expect(url.searchParams.get("scope")).toBe(OIDC_SCOPE);
    expect(url.searchParams.get("scope")).not.toContain("offline_access");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("redirect_uri")).toBe(config.callbackUrl);
  });

  it("uses the registered app root for managed logout", () => {
    const url = buildManagedLogoutUrl(config);
    expect(url.pathname).toBe("/logout");
    expect(url.searchParams.get("client_id")).toBe(config.clientId);
    expect(url.searchParams.get("logout_uri")).toBe(config.appUrl);
  });

  it("accepts state-changing POSTs only from the app origin", () => {
    expect(isTrustedPostOrigin(new Request(`${config.appUrl}/api/auth/signout`, {
      headers: { origin: config.appUrl },
    }), config.appUrl)).toBe(true);
    expect(isTrustedPostOrigin(new Request(`${config.appUrl}/api/auth/signout`, {
      headers: { origin: "https://evil.example" },
    }), config.appUrl)).toBe(false);
  });
});

describe("Experts Cognito requests", () => {
  it("exchanges the code with the exact callback and verifier", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({
      id_token: "id", access_token: "access", refresh_token: "refresh", expires_in: 3600,
    }));
    await exchangeCode(config, "code", "verifier", fetcher as unknown as typeof fetch);
    const [url, init] = fetcher.mock.calls[0]!;
    const body = init?.body as URLSearchParams;
    expect(url).toBe(`${config.domain}/oauth2/token`);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("redirect_uri")).toBe(config.callbackUrl);
    expect(body.get("code_verifier")).toBe("verifier");
  });

  it("refreshes and revokes as a public client", async () => {
    const tokenFetcher = vi.fn<typeof fetch>(async () => Response.json({
      id_token: "id", access_token: "access",
    }));
    await refreshTokens(config, "refresh", tokenFetcher as unknown as typeof fetch);
    const refreshBody = tokenFetcher.mock.calls[0]![1]?.body as URLSearchParams;
    expect(refreshBody.get("grant_type")).toBe("refresh_token");
    expect(refreshBody.get("client_id")).toBe(config.clientId);

    const revokeFetcher = vi.fn<typeof fetch>(async () => new Response(null, { status: 200 }));
    await revokeRefreshToken(config, "refresh", revokeFetcher as unknown as typeof fetch);
    const revokeBody = revokeFetcher.mock.calls[0]![1]?.body as URLSearchParams;
    expect(revokeFetcher.mock.calls[0]![0]).toBe(`${config.domain}/oauth2/revoke`);
    expect(revokeBody.get("token")).toBe("refresh");
    expect(revokeBody.get("client_id")).toBe(config.clientId);
  });

  it("calls Cognito GlobalSignOut with the access token", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(null, { status: 200 }));
    await globalSignOut(config, "access", fetcher as unknown as typeof fetch);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://cognito-idp.us-east-1.amazonaws.com/");
    expect((init?.headers as Record<string, string>)["x-amz-target"]).toContain("GlobalSignOut");
    expect(init?.body).toBe(JSON.stringify({ AccessToken: "access" }));
  });
});

describe("Experts Cognito ID-token verification", () => {
  let verificationKey: ReturnType<typeof createLocalJWKSet>;
  let privateKey: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];

  beforeAll(async () => {
    const pair = await generateKeyPair("RS256");
    privateKey = pair.privateKey;
    const publicJwk = await exportJWK(pair.publicKey);
    verificationKey = createLocalJWKSet({ keys: [{ ...publicJwk, alg: "RS256", kid: "test-key", use: "sig" }] });
  });

  async function token(values?: { audience?: string; nonce?: string; expired?: boolean }) {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({
      token_use: "id", email: "User@Example.com", email_verified: true, name: "Expert", nonce: values?.nonce ?? "expected",
    })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(config.issuer)
      .setAudience(values?.audience ?? config.clientId)
      .setSubject("subject-1")
      .setIssuedAt(now - 10)
      .setExpirationTime(values?.expired ? now - 1 : now + 300)
      .sign(privateKey);
  }

  it("accepts exact claims and normalizes the verified email", async () => {
    await expect(verifyIdToken(await token(), config, "expected", verificationKey)).resolves.toEqual({
      issuer: config.issuer,
      subject: "subject-1",
      email: "user@example.com",
      name: "Expert",
      emailVerified: true,
    });
  });

  it("rejects nonce, audience, and expiry mismatches", async () => {
    await expect(verifyIdToken(await token(), config, "wrong", verificationKey)).rejects.toThrow("Invalid OIDC nonce");
    await expect(verifyIdToken(await token({ audience: "other" }), config, "expected", verificationKey)).rejects.toThrow();
    await expect(verifyIdToken(await token({ expired: true }), config, "expected", verificationKey)).rejects.toThrow();
  });
});
