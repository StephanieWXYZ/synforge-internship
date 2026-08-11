import { createRemoteJWKSet, jwtVerify } from "jose";

export const OIDC_SCOPE = "openid profile email aws.cognito.signin.user.admin";
export const OIDC_COOKIES = {
  state: "experts_oidc_state",
  nonce: "experts_oidc_nonce",
  verifier: "experts_oidc_verifier",
  returnTo: "experts_oidc_return_to",
  intent: "experts_oidc_intent",
  access: "experts_oidc_access",
  refresh: "experts_oidc_refresh",
} as const;

export type OidcConfig = {
  issuer: string;
  domain: string;
  clientId: string;
  appUrl: string;
  callbackUrl: string;
};

export type OidcIdentity = {
  issuer: string;
  subject: string;
  email: string;
  name: string;
  emailVerified: true;
};

export type CognitoTokens = {
  id_token: string;
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

type Fetcher = typeof fetch;
const jwksByIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export function getOidcConfig(): OidcConfig {
  const issuer = required("COGNITO_ISSUER");
  const domain = trimSlash(required("COGNITO_DOMAIN"));
  const clientId = required("COGNITO_CLIENT_ID");
  const appUrl = trimSlash(required("NEXT_PUBLIC_APP_URL"));
  for (const [name, value] of [["COGNITO_ISSUER", issuer], ["COGNITO_DOMAIN", domain]] as const) {
    if (new URL(value).protocol !== "https:") throw new Error(`${name} must use HTTPS`);
  }
  const app = new URL(appUrl);
  if (process.env.NODE_ENV === "production" && app.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_APP_URL must use HTTPS in production");
  }
  return {
    issuer,
    domain,
    clientId,
    appUrl,
    callbackUrl: new URL("/api/auth/callback", `${appUrl}/`).toString(),
  };
}

export function normalizeReturnTo(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return "/";
  try {
    const url = new URL(value, "https://return.invalid");
    if (url.origin !== "https://return.invalid" || url.pathname.startsWith("/api/auth/")) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export function buildAuthorizeUrl(config: OidcConfig, values: { state: string; nonce: string; challenge: string }) {
  const url = new URL("/oauth2/authorize", `${config.domain}/`);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    scope: OIDC_SCOPE,
    redirect_uri: config.callbackUrl,
    state: values.state,
    nonce: values.nonce,
    code_challenge: values.challenge,
    code_challenge_method: "S256",
  }).toString();
  return url;
}

export function buildManagedLogoutUrl(config: OidcConfig) {
  const url = new URL("/logout", `${config.domain}/`);
  url.search = new URLSearchParams({ client_id: config.clientId, logout_uri: config.appUrl }).toString();
  return url;
}

export function isTrustedPostOrigin(request: Request, appUrl: string) {
  const origin = request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";
  try { return new URL(origin).origin === new URL(appUrl).origin; } catch { return false; }
}

export async function exchangeCode(config: OidcConfig, code: string, verifier: string, fetcher: Fetcher = fetch) {
  return requestTokens(config, new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    code,
    redirect_uri: config.callbackUrl,
    code_verifier: verifier,
  }), fetcher);
}

export async function refreshTokens(config: OidcConfig, refreshToken: string, fetcher: Fetcher = fetch) {
  return requestTokens(config, new URLSearchParams({
    grant_type: "refresh_token",
    client_id: config.clientId,
    refresh_token: refreshToken,
  }), fetcher);
}

export async function revokeRefreshToken(config: OidcConfig, token: string, fetcher: Fetcher = fetch) {
  const response = await fetcher(`${config.domain}/oauth2/revoke`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token, client_id: config.clientId }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`OIDC token revocation failed (${response.status})`);
}

export async function globalSignOut(config: OidcConfig, accessToken: string, fetcher: Fetcher = fetch) {
  const response = await fetcher(`${new URL(config.issuer).origin}/`, {
    method: "POST",
    headers: {
      "content-type": "application/x-amz-json-1.1",
      "x-amz-target": "AWSCognitoIdentityProviderService.GlobalSignOut",
    },
    body: JSON.stringify({ AccessToken: accessToken }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`OIDC global sign-out failed (${response.status})`);
}

export async function verifyIdToken(
  token: string,
  config: OidcConfig,
  expectedNonce?: string,
  verificationKey?: Parameters<typeof jwtVerify>[1],
): Promise<OidcIdentity> {
  let key = verificationKey;
  if (!key) {
    let remote = jwksByIssuer.get(config.issuer);
    if (!remote) {
      remote = createRemoteJWKSet(new URL(`${trimSlash(config.issuer)}/.well-known/jwks.json`));
      jwksByIssuer.set(config.issuer, remote);
    }
    key = remote;
  }
  const { payload } = await jwtVerify(token, key, { issuer: config.issuer, audience: config.clientId });
  if (payload.token_use !== "id") throw new Error("Invalid Cognito token use");
  if (expectedNonce && payload.nonce !== expectedNonce) throw new Error("Invalid OIDC nonce");
  if (!payload.sub || !payload.email) throw new Error("Required OIDC claims missing");
  if (payload.email_verified !== true) throw new Error("OIDC email is not verified");
  return {
    issuer: config.issuer,
    subject: payload.sub,
    email: String(payload.email).trim().toLowerCase(),
    name: String(payload.name || payload.email),
    emailVerified: true,
  };
}

async function requestTokens(config: OidcConfig, body: URLSearchParams, fetcher: Fetcher) {
  const response = await fetcher(`${config.domain}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`OIDC token exchange failed (${response.status})`);
  const value = await response.json() as Partial<CognitoTokens>;
  if (!value.id_token || !value.access_token) throw new Error("OIDC token response is incomplete");
  return {
    id_token: value.id_token,
    access_token: value.access_token,
    refresh_token: value.refresh_token,
    expires_in: Number(value.expires_in || 3600),
  } satisfies CognitoTokens;
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for OIDC`);
  return value;
}

function trimSlash(value: string) { return value.replace(/\/+$/, ""); }
