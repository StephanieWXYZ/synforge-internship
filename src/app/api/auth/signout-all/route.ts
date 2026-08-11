import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { clearSessionResponseCookie, deleteCurrentSession } from "@/lib/auth";
import { auditAuth } from "@/lib/authAudit";
import { buildManagedLogoutUrl, getOidcConfig, globalSignOut, isTrustedPostOrigin, OIDC_COOKIES, refreshTokens } from "@/lib/oidc";
import { clearOidcCookies } from "@/lib/oidcCookies";

export async function POST(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  if (!isTrustedPostOrigin(request, appUrl)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  let destination = new URL("/sign-in", appUrl);
  try {
    const config = getOidcConfig();
    destination = buildManagedLogoutUrl(config);
    const jar = await cookies();
    let access = jar.get(OIDC_COOKIES.access)?.value;
    const refresh = jar.get(OIDC_COOKIES.refresh)?.value;
    if (!access && refresh) access = (await refreshTokens(config, refresh)).access_token;
    if (!access) throw new Error("No Cognito access token is available");
    await globalSignOut(config, access);
  } catch {
    auditAuth("oidc.signout", "failure", "global_signout_failed", { scope: "all_devices" });
  }
  await deleteCurrentSession();
  const response = NextResponse.redirect(destination, 303);
  clearSessionResponseCookie(response);
  clearOidcCookies(response);
  auditAuth("oidc.signout", "success", "completed", { scope: "all_devices" });
  return response;
}
