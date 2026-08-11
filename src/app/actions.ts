"use server";

import { redirect } from "next/navigation";

import {
  authenticateUser,
  createSession,
  createUserAccount,
  destroySession,
  requireUser,
} from "@/lib/auth";
import { auditAuth } from "@/lib/authAudit";
import { isLegacyRegistrationEnabled } from "@/lib/authPolicy";
import { db } from "@/lib/db";

function authErrorRedirectPath(path: string, error: string) {
  return `${path}?error=${encodeURIComponent(error)}`;
}

export async function createChatbotAction(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const domain = String(formData.get("domain") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const systemPrompt = String(formData.get("systemPrompt") ?? "").trim();

  if (!name || !domain || !description || !systemPrompt) {
    throw new Error("All chatbot fields are required.");
  }

  const chatbot = await db.chatbot.create({
    data: { userId: user.id, name, domain, description, systemPrompt },
  });

  redirect(`/chatbots/${chatbot.id}`);
}

export async function signUpAction(formData: FormData) {
  const name = String(formData.get("name") ?? "");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  let redirectPath = "/";

  try {
    const user = await createUserAccount(name, email, password);
    await createSession(user.id);
    auditAuth("legacy.registration", "success", "completed");
  } catch (error) {
    auditAuth(
      "legacy.registration",
      "failure",
      isLegacyRegistrationEnabled() ? "unexpected_error" : "registration_disabled",
    );
    redirectPath = authErrorRedirectPath(
      "/sign-up",
      error instanceof Error ? error.message : "Sign up failed.",
    );
  }

  redirect(redirectPath);
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  let redirectPath = "/";

  try {
    const user = await authenticateUser(email, password);
    await createSession(user.id);
    auditAuth("legacy.signin", "success", "completed");
  } catch (error) {
    auditAuth("legacy.signin", "failure", "invalid_credentials");
    redirectPath = authErrorRedirectPath(
      "/sign-in",
      error instanceof Error ? error.message : "Sign in failed.",
    );
  }

  redirect(redirectPath);
}

export async function signOutAction() {
  await destroySession();
  redirect("/sign-in");
}
