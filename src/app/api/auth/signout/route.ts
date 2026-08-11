import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { clearSessionResponseCookie, deleteCurrentSession } from "@/lib/auth";
import { auditAuth } from "@/lib/authAudit";
import { getOidcConfig, isTrustedPostOrigin, OIDC_COOKIES, revokeRefreshToken } from "@/lib/oidc";
import { clearOidcCookies } from "@/lib/oidcCookies";

export async function POST(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  if (!isTrustedPostOrigin(request, appUrl)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  const refresh = (await cookies()).get(OIDC_COOKIES.refresh)?.value;
  if (refresh) {
    try { await revokeRefreshToken(getOidcConfig(), refresh); } catch {
      auditAuth("oidc.signout", "failure", "token_revocation_failed", { scope: "local" });
    }
  }
  await deleteCurrentSession();
  const response = NextResponse.redirect(new URL("/sign-in", appUrl), 303);
  clearSessionResponseCookie(response);
  clearOidcCookies(response);
  auditAuth("oidc.signout", "success", "completed", { scope: "local" });
  return response;
}
