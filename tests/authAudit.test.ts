import { afterEach, describe, expect, it, vi } from "vitest";

import { auditAuth } from "@/lib/authAudit";
import { isLegacyRegistrationEnabled, isOidcRolloutEnabled } from "@/lib/authPolicy";

afterEach(() => {
  delete process.env.OIDC_ROLLOUT_ENABLED;
  vi.restoreAllMocks();
});

describe("authentication rollout policy", () => {
  it("keeps legacy registration available until rollout is explicitly enabled", () => {
    expect(isOidcRolloutEnabled()).toBe(false);
    expect(isLegacyRegistrationEnabled()).toBe(true);
    process.env.OIDC_ROLLOUT_ENABLED = "TRUE";
    expect(isOidcRolloutEnabled()).toBe(true);
    expect(isLegacyRegistrationEnabled()).toBe(false);
  });
});

describe("authentication audit events", () => {
  it("emits only the fixed non-PII event schema", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    auditAuth("oidc.callback", "failure", "link_email_mismatch", { intent: "link" });

    const payload = JSON.parse(String(info.mock.calls[0]![0])) as Record<string, unknown>;
    expect(payload).toMatchObject({
      type: "auth.audit",
      event: "oidc.callback",
      outcome: "failure",
      reason: "link_email_mismatch",
      intent: "link",
    });
    expect(Object.keys(payload).sort()).toEqual([
      "event", "intent", "outcome", "reason", "timestamp", "type",
    ]);
    expect(JSON.stringify(payload)).not.toContain("@");
    expect(JSON.stringify(payload)).not.toMatch(/bearer |eyJ[A-Za-z0-9_-]+\./i);
  });
});
