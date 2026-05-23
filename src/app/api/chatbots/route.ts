import { NextResponse } from "next/server";

import { db } from "@/lib/db";

export async function GET() {
  const chatbots = await db.chatbot.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { documents: true } } },
  });
  return NextResponse.json({ chatbots });
}

export async function POST(request: Request) {
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const domain = String(body.domain ?? "").trim();
  const description = String(body.description ?? "").trim();
  const systemPrompt = String(body.systemPrompt ?? "").trim();

  if (!name || !domain || !description || !systemPrompt) {
    return NextResponse.json({ error: "All chatbot fields are required." }, { status: 400 });
  }

  const chatbot = await db.chatbot.create({
    data: { name, domain, description, systemPrompt },
  });

  return NextResponse.json({ chatbot }, { status: 201 });
}
