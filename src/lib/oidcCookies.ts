import type { NextResponse } from "next/server";

import { OIDC_COOKIES, type CognitoTokens } from "@/lib/oidc";

export const transientCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/auth",
  maxAge: 600,
});

export function setTokenCookies(response: NextResponse, tokens: CognitoTokens) {
  const base = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/api/auth" };
  response.cookies.set({ name: OIDC_COOKIES.access, value: tokens.access_token, ...base, maxAge: tokens.expires_in });
  if (tokens.refresh_token) {
    response.cookies.set({ name: OIDC_COOKIES.refresh, value: tokens.refresh_token, ...base, maxAge: 30 * 24 * 60 * 60 });
  }
}

export function clearOidcCookies(response: NextResponse) {
  for (const name of Object.values(OIDC_COOKIES)) expire(response, name);
}

export function clearTransientOidcCookies(response: NextResponse) {
  for (const name of [
    OIDC_COOKIES.state,
    OIDC_COOKIES.nonce,
    OIDC_COOKIES.verifier,
    OIDC_COOKIES.returnTo,
    OIDC_COOKIES.intent,
  ]) expire(response, name);
}

function expire(response: NextResponse, name: string) {
    response.cookies.set({
      name,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/auth",
      maxAge: 0,
      expires: new Date(0),
    });
}
