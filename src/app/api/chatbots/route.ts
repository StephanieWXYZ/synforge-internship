import { NextResponse } from "next/server";

import { authenticationErrorResponse, requireApiUser } from "@/lib/auth";
import { db } from "@/lib/db";

type ChatbotFieldErrors = {
  name?: string;
  domain?: string;
  description?: string;
  systemPrompt?: string;
};

function validateChatbotFields(input: {
  name: string;
  domain: string;
  description: string;
  systemPrompt: string;
}) {
  const fieldErrors: ChatbotFieldErrors = {};

  if (!input.name) {
    fieldErrors.name = "Name is required.";
  }
  if (!input.domain) {
    fieldErrors.domain = "Domain/category is required.";
  }
  if (!input.description) {
    fieldErrors.description = "Description is required.";
  }
  if (!input.systemPrompt) {
    fieldErrors.systemPrompt = "System prompt/instructions are required.";
  }

  return fieldErrors;
}

export async function GET() {
  try {
    const user = await requireApiUser();
    const chatbots = await db.chatbot.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { documents: true } } },
    });
    return NextResponse.json({ chatbots });
  } catch (error) {
    return authenticationErrorResponse(error) ?? NextResponse.json({ error: "Request failed." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const domain = String(body.domain ?? "").trim();
    const description = String(body.description ?? "").trim();
    const systemPrompt = String(body.systemPrompt ?? "").trim();

    const fieldErrors = validateChatbotFields({ name, domain, description, systemPrompt });
    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json(
        { error: "Please fix the highlighted fields.", fieldErrors },
        { status: 400 },
      );
    }

    const chatbot = await db.chatbot.create({
      data: { userId: user.id, name, domain, description, systemPrompt },
    });

    return NextResponse.json({ chatbot }, { status: 201 });
  } catch (error) {
    return authenticationErrorResponse(error) ?? NextResponse.json({ error: "Request failed." }, { status: 400 });
  }
}
