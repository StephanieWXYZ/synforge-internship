import { NextResponse } from "next/server";

import { authenticationErrorResponse, requireApiUser } from "@/lib/auth";
import { db } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const chatbot = await db.chatbot.findFirst({
      where: { id, userId: user.id },
      include: {
        documents: { where: { userId: user.id }, orderBy: { createdAt: "desc" } },
        _count: { select: { chunks: true, conversations: true } },
      },
    });

    if (!chatbot) {
      return NextResponse.json({ error: "Chatbot not found." }, { status: 404 });
    }

    return NextResponse.json({ chatbot });
  } catch (error) {
    return authenticationErrorResponse(error) ?? NextResponse.json({ error: "Request failed." }, { status: 400 });
  }
}
