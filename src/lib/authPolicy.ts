export function isOidcRolloutEnabled() {
  return process.env.OIDC_ROLLOUT_ENABLED?.trim().toLowerCase() === "true";
}

export function isLegacyRegistrationEnabled() {
  return !isOidcRolloutEnabled();
}
