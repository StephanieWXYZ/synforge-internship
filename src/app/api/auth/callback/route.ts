import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import {
  createSessionRecord,
  AccountLinkError,
  deleteCurrentSession,
  getCurrentUser,
  resolveOidcUser,
  setSessionResponseCookie,
} from "@/lib/auth";
import { auditAuth, type AuthAuditReason } from "@/lib/authAudit";
import { exchangeCode, getOidcConfig, normalizeReturnTo, OIDC_COOKIES, verifyIdToken } from "@/lib/oidc";
import { clearTransientOidcCookies, setTokenCookies } from "@/lib/oidcCookies";

export async function GET(request: NextRequest) {
  let intent: "signin" | "link" = "signin";
  try {
    const config = getOidcConfig();
    const jar = await cookies();
    if (request.nextUrl.searchParams.get("error")) throw new Error("OIDC provider rejected the request");
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const expectedState = jar.get(OIDC_COOKIES.state)?.value;
    if (!code || !state || !expectedState || state !== expectedState) throw new Error("Invalid OAuth state");
    const nonce = jar.get(OIDC_COOKIES.nonce)?.value;
    const verifier = jar.get(OIDC_COOKIES.verifier)?.value;
    if (!nonce || !verifier) throw new Error("Expired login attempt");

    const linking = jar.get(OIDC_COOKIES.intent)?.value === "link";
    intent = linking ? "link" : "signin";
    const legacyUser = linking ? await getCurrentUser() : null;
    if (linking && !legacyUser) throw new AccountLinkError("link_session_expired");

    const tokens = await exchangeCode(config, code, verifier);
    const identity = await verifyIdToken(tokens.id_token, config, nonce);
    const user = await resolveOidcUser(identity, legacyUser?.id);
    if (legacyUser) await deleteCurrentSession();
    const sessionId = await createSessionRecord(user.id);
    const returnTo = normalizeReturnTo(jar.get(OIDC_COOKIES.returnTo)?.value);
    const response = NextResponse.redirect(new URL(returnTo, `${config.appUrl}/`));
    setSessionResponseCookie(response, sessionId);
    setTokenCookies(response, tokens);
    clearTransientOidcCookies(response);
    auditAuth("oidc.callback", "success", "completed", { intent });
    return response;
  } catch (error) {
    const reason = callbackFailureReason(error);
    auditAuth("oidc.callback", "failure", reason, { intent });
    const url = new URL(error instanceof AccountLinkError ? "/account-link" : "/sign-in", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
    if (error instanceof AccountLinkError) url.searchParams.set("status", error.issue);
    else url.searchParams.set("error", "SyncForge sign-in failed. Please try again.");
    const response = NextResponse.redirect(url);
    clearTransientOidcCookies(response);
    return response;
  }
}

function callbackFailureReason(error: unknown): AuthAuditReason {
  if (error instanceof AccountLinkError) return error.issue;
  if (!(error instanceof Error)) return "unexpected_error";
  if (error.message === "Invalid OAuth state") return "invalid_state";
  if (error.message === "Expired login attempt") return "expired_attempt";
  if (error.message === "OIDC provider rejected the request") return "provider_rejected";
  if (error.message.includes("required for OIDC") || error.message.includes("must use HTTPS")) return "configuration_error";
  return "unexpected_error";
}
