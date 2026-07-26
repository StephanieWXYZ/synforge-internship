import { NextResponse } from "next/server";

import { authenticationErrorResponse, requireApiUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateChatAnswer } from "@/lib/llm";
import { buildRagResponse } from "@/lib/rag";
import { buildContext, retrieveRelevantChunks } from "@/lib/retrieval";
import { findConversationForChatbot } from "@/lib/resourceValidation";

export const runtime = "nodejs";

type ChatbotForAnswer = {
  domain: string;
  description: string;
  systemPrompt: string;
};

function buildSystemPrompt(chatbot: ChatbotForAnswer) {
  return [
    chatbot.systemPrompt,
    `Domain: ${chatbot.domain}`,
    `Description: ${chatbot.description}`,
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const chatbotId = String(body.chatbotId ?? "");
    const submittedQuestion = String(body.question ?? "").trim();
    const retryMessageId = String(body.retryMessageId ?? "").trim();
    let conversationId = body.conversationId ? String(body.conversationId) : "";

    if (!chatbotId || (!submittedQuestion && !retryMessageId)) {
      return NextResponse.json(
        { error: "chatbotId and question are required." },
        { status: 400 },
      );
    }

    const chatbot = await db.chatbot.findFirst({ where: { id: chatbotId, userId: user.id } });
    if (!chatbot) {
      return NextResponse.json({ error: "Chatbot not found." }, { status: 404 });
    }

    let question = submittedQuestion;
    let userMessage:
      | {
          id: string;
          conversationId: string;
          role: string;
          content: string;
        }
      | null = null;

    if (retryMessageId) {
      userMessage = await db.message.findFirst({
        where: {
          id: retryMessageId,
          userId: user.id,
          role: "user",
          conversation: { chatbotId, userId: user.id },
        },
      });

      if (!userMessage) {
        return NextResponse.json({ error: "Message not found." }, { status: 404 });
      }

      question = userMessage.content;
      conversationId = userMessage.conversationId;
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

    if (!userMessage) {
      userMessage = await db.message.create({
        data: { userId: user.id, conversationId, role: "user", content: question },
      });
    }

    let ragResponse: Awaited<ReturnType<typeof buildRagResponse>>;
    try {
      ragResponse = await buildRagResponse(chunks, () =>
        generateChatAnswer({
          systemPrompt: buildSystemPrompt(chatbot),
          context: buildContext(chunks),
          question,
        }),
      );
    } catch {
      return NextResponse.json(
        {
          error: "Assistant response failed. Please retry.",
          conversationId,
          userMessage,
          retryMessageId: userMessage.id,
        },
        { status: 500 },
      );
    }

    const assistantMessage = await db.message.create({
      data: {
        userId: user.id,
        conversationId,
        role: "assistant",
        content: ragResponse.answer,
        sourcesJson: JSON.stringify(ragResponse.sources),
      },
    });

    return NextResponse.json({
      conversationId,
      userMessage,
      message: assistantMessage,
      sources: ragResponse.sources,
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
