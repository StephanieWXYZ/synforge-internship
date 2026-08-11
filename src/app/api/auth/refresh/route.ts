import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { clearSessionResponseCookie, createSessionRecord, deleteCurrentSession, resolveOidcUser, setSessionResponseCookie } from "@/lib/auth";
import { auditAuth } from "@/lib/authAudit";
import { getOidcConfig, normalizeReturnTo, OIDC_COOKIES, refreshTokens, verifyIdToken } from "@/lib/oidc";
import { clearOidcCookies, setTokenCookies } from "@/lib/oidcCookies";

export async function GET(request: NextRequest) {
  const returnTo = normalizeReturnTo(request.nextUrl.searchParams.get("returnTo"));
  const refreshToken = (await cookies()).get(OIDC_COOKIES.refresh)?.value;
  if (!refreshToken) {
    const url = new URL("/api/auth/signin", request.url);
    url.searchParams.set("returnTo", returnTo);
    return NextResponse.redirect(url);
  }
  try {
    const config = getOidcConfig();
    const tokens = await refreshTokens(config, refreshToken);
    const user = await resolveOidcUser(await verifyIdToken(tokens.id_token, config));
    await deleteCurrentSession();
    const response = NextResponse.redirect(new URL(returnTo, `${config.appUrl}/`));
    setSessionResponseCookie(response, await createSessionRecord(user.id));
    setTokenCookies(response, tokens);
    auditAuth("oidc.refresh", "success", "completed");
    return response;
  } catch {
    auditAuth("oidc.refresh", "failure", "token_refresh_failed");
    const response = NextResponse.redirect(new URL("/sign-in?error=Your+session+expired.", request.url));
    clearSessionResponseCookie(response);
    clearOidcCookies(response);
    return response;
  }
}
