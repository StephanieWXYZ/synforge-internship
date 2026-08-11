import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { auditAuth } from "@/lib/authAudit";
import { buildAuthorizeUrl, getOidcConfig, normalizeReturnTo, OIDC_COOKIES } from "@/lib/oidc";
import { transientCookieOptions } from "@/lib/oidcCookies";

export async function GET(request: NextRequest) {
  try {
    const intent = request.nextUrl.searchParams.get("intent") === "link" ? "link" : "signin";
    if (intent === "link" && !(await getCurrentUser())) {
      return NextResponse.redirect(new URL("/sign-in?error=Sign+in+with+your+existing+password+first.", request.url));
    }
    const config = getOidcConfig();
    const state = randomBytes(24).toString("base64url");
    const nonce = randomBytes(24).toString("base64url");
    const verifier = randomBytes(48).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const response = NextResponse.redirect(buildAuthorizeUrl(config, { state, nonce, challenge }));
    const options = transientCookieOptions();
    response.cookies.set(OIDC_COOKIES.state, state, options);
    response.cookies.set(OIDC_COOKIES.nonce, nonce, options);
    response.cookies.set(OIDC_COOKIES.verifier, verifier, options);
    response.cookies.set(OIDC_COOKIES.returnTo, normalizeReturnTo(request.nextUrl.searchParams.get("returnTo")), options);
    response.cookies.set(OIDC_COOKIES.intent, intent, options);
    auditAuth("oidc.signin", "success", "started", { intent });
    return response;
  } catch {
    auditAuth("oidc.signin", "failure", "configuration_error");
    return NextResponse.json({ error: "OIDC is not configured." }, { status: 503 });
  }
}
