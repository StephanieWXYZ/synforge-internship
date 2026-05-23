import { NextResponse } from "next/server";

import { db } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const chatbot = await db.chatbot.findUnique({
    where: { id },
    include: {
      documents: { orderBy: { createdAt: "desc" } },
      _count: { select: { chunks: true, conversations: true } },
    },
  });

  if (!chatbot) {
    return NextResponse.json({ error: "Chatbot not found." }, { status: 404 });
  }

  return NextResponse.json({ chatbot });
}
