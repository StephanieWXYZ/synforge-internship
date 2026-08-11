import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { isLegacyRegistrationEnabled } from "@/lib/authPolicy";
import type { OidcIdentity } from "@/lib/oidc";

export const SESSION_COOKIE_NAME = "tsf_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const PASSWORD_KEY_LENGTH = 64;

export class AuthenticationError extends Error {
  constructor(message = "You must sign in to continue.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export type AccountLinkIssue =
  | "legacy_link_required"
  | "link_email_mismatch"
  | "identity_already_linked"
  | "link_session_expired";

export class AccountLinkError extends Error {
  constructor(public readonly issue: AccountLinkIssue) {
    super(issue);
    this.name = "AccountLinkError";
  }
}

export class LegacyAccountLinkRequiredError extends AccountLinkError {
  constructor() { super("legacy_link_required"); }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString("hex");
}

function verifyPassword(password: string, salt: string, passwordHash: string) {
  const passwordBuffer = Buffer.from(hashPassword(password, salt), "hex");
  const storedPasswordBuffer = Buffer.from(passwordHash, "hex");

  if (passwordBuffer.length !== storedPasswordBuffer.length) {
    return false;
  }

  return timingSafeEqual(passwordBuffer, storedPasswordBuffer);
}

export async function createUserAccount(name: string, email: string, password: string) {
  if (!isLegacyRegistrationEnabled()) {
    throw new Error("New accounts must be created with SyncForge.");
  }
  const normalizedEmail = normalizeEmail(email);

  if (!name.trim() || !normalizedEmail || password.length < 8) {
    throw new Error("Name, email, and a password of at least 8 characters are required.");
  }

  const existingUser = await db.user.findUnique({ where: { email: normalizedEmail } });
  if (existingUser) {
    throw new Error("An account with this email already exists.");
  }

  const passwordSalt = randomBytes(16).toString("hex");
  return db.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      passwordSalt,
      passwordHash: hashPassword(password, passwordSalt),
    },
  });
}

export async function authenticateUser(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email: normalizeEmail(email) } });

  if (
    !user ||
    !user.passwordSalt ||
    !user.passwordHash ||
    !verifyPassword(password, user.passwordSalt, user.passwordHash)
  ) {
    throw new Error("Invalid email or password.");
  }

  return user;
}

export async function createSession(userId: string) {
  const sessionId = await createSessionRecord(userId);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionId, sessionCookieOptions());
}

export async function createSessionRecord(userId: string) {
  const sessionId = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await db.session.create({
    data: { id: sessionId, userId, expiresAt },
  });

  return sessionId;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  } as const;
}

export function setSessionResponseCookie(response: NextResponse, sessionId: string) {
  response.cookies.set(SESSION_COOKIE_NAME, sessionId, sessionCookieOptions());
}

export function clearSessionResponseCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    ...sessionCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  });
}

export async function deleteCurrentSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionId) {
    await db.session.deleteMany({ where: { id: sessionId } });
  }

  return sessionId;
}

export async function destroySession() {
  const cookieStore = await cookies();
  await deleteCurrentSession();

  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function resolveOidcUser(identity: OidcIdentity, linkingUserId?: string) {
  const mapped = await db.user.findUnique({
    where: {
      oidcIssuer_oidcSubject: {
        oidcIssuer: identity.issuer,
        oidcSubject: identity.subject,
      },
    },
  });
  if (mapped) {
    if (linkingUserId && mapped.id !== linkingUserId) {
      throw new AccountLinkError("identity_already_linked");
    }
    return mapped;
  }

  if (linkingUserId) {
    const linkingUser = await db.user.findUnique({ where: { id: linkingUserId } });
    if (!linkingUser || normalizeEmail(linkingUser.email) !== identity.email) {
      throw new AccountLinkError("link_email_mismatch");
    }
    if (linkingUser.oidcSubject || linkingUser.oidcIssuer) {
      throw new AccountLinkError("identity_already_linked");
    }
    return db.user.update({
      where: { id: linkingUser.id },
      data: {
        oidcIssuer: identity.issuer,
        oidcSubject: identity.subject,
        emailVerified: true,
        name: identity.name,
      },
    });
  }

  const sameEmail = await db.user.findUnique({ where: { email: identity.email } });
  if (sameEmail) throw new LegacyAccountLinkRequiredError();

  return db.user.create({
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
}

export async function getCurrentUser() {
  const sessionId = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) {
    return null;
  }

  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session || session.expiresAt <= new Date()) {
    return null;
  }

  return session.user;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  return user;
}

export async function requireApiUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new AuthenticationError();
  }

  return user;
}

export function authenticationErrorResponse(error: unknown) {
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  return null;
}
