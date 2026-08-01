import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";

const SESSION_COOKIE_NAME = "tsf_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const PASSWORD_KEY_LENGTH = 64;

export class AuthenticationError extends Error {
  constructor(message = "You must sign in to continue.") {
    super(message);
    this.name = "AuthenticationError";
  }
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

  if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    throw new Error("Invalid email or password.");
  }

  return user;
}

export async function createSession(userId: string) {
  const sessionId = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await db.session.create({
    data: { id: sessionId, userId, expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionId) {
    await db.session.deleteMany({ where: { id: sessionId } });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
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
