import { NextResponse } from "next/server";

import { authenticationErrorResponse, requireApiUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateChatAnswer } from "@/lib/llm";
import { buildRagResponse } from "@/lib/rag";
import { buildContext, retrieveRelevantChunks } from "@/lib/retrieval";
import { findConversationForChatbot } from "@/lib/resourceValidation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const chatbotId = String(body.chatbotId ?? "");
    const question = String(body.question ?? "").trim();
    let conversationId = body.conversationId ? String(body.conversationId) : "";

    if (!chatbotId || !question) {
      return NextResponse.json({ error: "chatbotId and question are required." }, { status: 400 });
    }

    const chatbot = await db.chatbot.findFirst({ where: { id: chatbotId, userId: user.id } });
    if (!chatbot) {
      return NextResponse.json({ error: "Chatbot not found." }, { status: 404 });
    }

    if (!conversationId) {
      const conversation = await db.conversation.create({
        data: {
          userId: user.id,
          chatbotId,
          title: question.slice(0, 80),
        },
      });
      conversationId = conversation.id;
    } else {
      const conversation = await findConversationForChatbot(user.id, chatbotId, conversationId);

      if (!conversation) {
        return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
      }
    }

    const chunks = await retrieveRelevantChunks(user.id, chatbotId, question);

    await db.message.create({
      data: { userId: user.id, conversationId, role: "user", content: question },
    });

    const { answer, sources } = await buildRagResponse(chunks, () =>
      generateChatAnswer({
        systemPrompt: [
          chatbot.systemPrompt,
          `Domain: ${chatbot.domain}`,
          `Description: ${chatbot.description}`,
        ].join("\n"),
        context: buildContext(chunks),
        question,
      }),
    );

    const assistantMessage = await db.message.create({
      data: {
        userId: user.id,
        conversationId,
        role: "assistant",
        content: answer,
        sourcesJson: JSON.stringify(sources),
      },
    });

    return NextResponse.json({
      conversationId,
      message: assistantMessage,
      sources,
    });
  } catch (error) {
    const authResponse = authenticationErrorResponse(error);
    if (authResponse) {
      return authResponse;
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Message failed." },
      { status: 400 },
    );
  }
}
