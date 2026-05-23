"use server";

import { redirect } from "next/navigation";

import { db } from "@/lib/db";

export async function createChatbotAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const domain = String(formData.get("domain") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const systemPrompt = String(formData.get("systemPrompt") ?? "").trim();

  if (!name || !domain || !description || !systemPrompt) {
    throw new Error("All chatbot fields are required.");
  }

  const chatbot = await db.chatbot.create({
    data: { name, domain, description, systemPrompt },
  });

  redirect(`/chatbots/${chatbot.id}`);
}
