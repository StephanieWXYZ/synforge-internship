import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { generateChatAnswer } from "@/lib/llm";
import { buildContext, retrieveRelevantChunks } from "@/lib/retrieval";

export const runtime = "nodejs";

const insufficientAnswer =
  "I don't have enough information in the uploaded documents to answer that.";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const chatbotId = String(body.chatbotId ?? "");
    const question = String(body.question ?? "").trim();
    let conversationId = body.conversationId ? String(body.conversationId) : "";

    if (!chatbotId || !question) {
      return NextResponse.json({ error: "chatbotId and question are required." }, { status: 400 });
    }

    const chatbot = await db.chatbot.findUnique({ where: { id: chatbotId } });
    if (!chatbot) {
      return NextResponse.json({ error: "Chatbot not found." }, { status: 404 });
    }

    if (!conversationId) {
      const conversation = await db.conversation.create({
        data: {
          chatbotId,
          title: question.slice(0, 80),
        },
      });
      conversationId = conversation.id;
    }

    const chunks = await retrieveRelevantChunks(chatbotId, question);
    const sources = chunks.map((chunk) => ({
      fileName: chunk.fileName,
      chunkIndex: chunk.chunkIndex,
      score: chunk.score,
    }));

    await db.message.create({
      data: { conversationId, role: "user", content: question },
    });

    const answer =
      chunks.length === 0
        ? insufficientAnswer
        : await generateChatAnswer({
            systemPrompt: [
              chatbot.systemPrompt,
              `Domain: ${chatbot.domain}`,
              `Description: ${chatbot.description}`,
            ].join("\n"),
            context: buildContext(chunks),
            question,
          });

    const assistantMessage = await db.message.create({
      data: {
        conversationId,
        role: "assistant",
        content: answer || insufficientAnswer,
        sourcesJson: JSON.stringify(sources),
      },
    });

    return NextResponse.json({
      conversationId,
      message: assistantMessage,
      sources,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Message failed." },
      { status: 400 },
    );
  }
}
