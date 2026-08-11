import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { clearSessionResponseCookie, deleteCurrentSession } from "@/lib/auth";
import { auditAuth } from "@/lib/authAudit";
import { buildManagedLogoutUrl, getOidcConfig, isTrustedPostOrigin, OIDC_COOKIES, revokeRefreshToken } from "@/lib/oidc";
import { clearOidcCookies } from "@/lib/oidcCookies";

export async function POST(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  if (!isTrustedPostOrigin(request, appUrl)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  let destination = new URL("/sign-in", appUrl);
  try {
    const config = getOidcConfig();
    destination = buildManagedLogoutUrl(config);
    const refresh = (await cookies()).get(OIDC_COOKIES.refresh)?.value;
    if (refresh) await revokeRefreshToken(config, refresh);
  } catch {
    auditAuth("oidc.signout", "failure", "token_revocation_failed", { scope: "managed" });
  }
  await deleteCurrentSession();
  const response = NextResponse.redirect(destination, 303);
  clearSessionResponseCookie(response);
  clearOidcCookies(response);
  auditAuth("oidc.signout", "success", "completed", { scope: "managed" });
  return response;
}
