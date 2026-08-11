export type AuthAuditEvent =
  | "oidc.signin"
  | "oidc.callback"
  | "oidc.refresh"
  | "oidc.signout"
  | "legacy.signin"
  | "legacy.registration";

export type AuthAuditReason =
  | "started"
  | "completed"
  | "invalid_state"
  | "expired_attempt"
  | "provider_rejected"
  | "legacy_link_required"
  | "link_email_mismatch"
  | "identity_already_linked"
  | "link_session_expired"
  | "registration_disabled"
  | "invalid_credentials"
  | "token_refresh_failed"
  | "token_revocation_failed"
  | "global_signout_failed"
  | "configuration_error"
  | "unexpected_error";

export function auditAuth(
  event: AuthAuditEvent,
  outcome: "success" | "failure",
  reason: AuthAuditReason,
  context: { intent?: "signin" | "link"; scope?: "local" | "managed" | "all_devices" } = {},
) {
  console.info(JSON.stringify({
    type: "auth.audit",
    event,
    outcome,
    reason,
    ...context,
    timestamp: new Date().toISOString(),
  }));
}
