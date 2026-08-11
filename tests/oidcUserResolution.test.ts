import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: mocks.findUnique,
      create: mocks.create,
      update: mocks.update,
    },
  },
}));

import { createUserAccount, LegacyAccountLinkRequiredError, resolveOidcUser } from "@/lib/auth";

const identity = {
  issuer: "https://issuer.example/pool",
  subject: "subject-1",
  email: "user@example.com",
  name: "OIDC User",
  emailVerified: true as const,
};

describe("Experts OIDC user resolution", () => {
  beforeEach(() => vi.clearAllMocks());

  it("blocks local-password registration once the OIDC rollout flag is enabled", async () => {
    process.env.OIDC_ROLLOUT_ENABLED = "true";
    await expect(createUserAccount("User", identity.email, "password123")).rejects.toThrow("SyncForge");
    expect(mocks.create).not.toHaveBeenCalled();
    delete process.env.OIDC_ROLLOUT_ENABLED;
  });

  it("returns an existing subject mapping before checking email", async () => {
    const mapped = { id: "user-1", email: identity.email };
    mocks.findUnique.mockResolvedValueOnce(mapped);
    await expect(resolveOidcUser(identity)).resolves.toBe(mapped);
    expect(mocks.findUnique).toHaveBeenCalledTimes(1);
  });

  it("does not turn a link attempt into a session for another mapped user", async () => {
    mocks.findUnique.mockResolvedValueOnce({ id: "other-user", email: identity.email });
    await expect(resolveOidcUser(identity, "legacy-1")).rejects.toMatchObject({
      issue: "identity_already_linked",
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("never silently merges an existing legacy account by email", async () => {
    mocks.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "legacy-1", email: identity.email });
    await expect(resolveOidcUser(identity)).rejects.toBeInstanceOf(LegacyAccountLinkRequiredError);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects explicit linking when the verified emails differ", async () => {
    mocks.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "legacy-1", email: "different@example.com", oidcIssuer: null, oidcSubject: null });
    await expect(resolveOidcUser(identity, "legacy-1")).rejects.toMatchObject({
      issue: "link_email_mismatch",
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("links only after a legacy session proves ownership and preserves the user id", async () => {
    const legacy = { id: "legacy-1", email: "USER@example.com", oidcIssuer: null, oidcSubject: null };
    const linked = { ...legacy, oidcIssuer: identity.issuer, oidcSubject: identity.subject };
    mocks.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(legacy);
    mocks.update.mockResolvedValueOnce(linked);
    await expect(resolveOidcUser(identity, legacy.id)).resolves.toBe(linked);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: legacy.id },
      data: {
        oidcIssuer: identity.issuer,
        oidcSubject: identity.subject,
        emailVerified: true,
        name: identity.name,
      },
    });
  });

  it("creates an OIDC-only local user when no account conflicts", async () => {
    mocks.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    mocks.create.mockResolvedValueOnce({ id: "new-1", ...identity });
    await resolveOidcUser(identity);
    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        email: identity.email,
        name: identity.name,
        passwordHash: null,
        passwordSalt: null,
        oidcIssuer: identity.issuer,
        oidcSubject: identity.subject,
        emailVerified: true,
      },
    });
  });
});
