import { NextResponse } from "next/server";

import { authenticationErrorResponse, requireApiUser } from "@/lib/auth";
import { db } from "@/lib/db";

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

    if (!name || !domain || !description || !systemPrompt) {
      return NextResponse.json({ error: "All chatbot fields are required." }, { status: 400 });
    }

    const chatbot = await db.chatbot.create({
      data: { userId: user.id, name, domain, description, systemPrompt },
    });

    return NextResponse.json({ chatbot }, { status: 201 });
  } catch (error) {
    return authenticationErrorResponse(error) ?? NextResponse.json({ error: "Request failed." }, { status: 400 });
  }
}
