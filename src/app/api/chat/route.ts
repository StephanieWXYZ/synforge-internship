import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { generateChatAnswer } from "@/lib/llm";
import { buildContext, retrieveRelevantChunks } from "@/lib/retrieval";
import { filterRelevantSources } from "@/lib/sourceFiltering";

export const runtime = "nodejs";

const insufficientAnswer =
  "I don't have enough information in the uploaded documents to answer that.";
const SOURCE_PREVIEW_MAX_LENGTH = 220;
const SOURCE_PREVIEW_ELLIPSIS = "...";

function buildSourcePreview(content: string) {
  const preview = content.replace(/\s+/g, " ").trim();
  if (preview.length <= SOURCE_PREVIEW_MAX_LENGTH) {
    return preview;
  }

  const previewTextLength = SOURCE_PREVIEW_MAX_LENGTH - SOURCE_PREVIEW_ELLIPSIS.length;

  return `${preview.slice(0, previewTextLength).trimEnd().replace(/[.,;:!?]+$/, "")}${SOURCE_PREVIEW_ELLIPSIS}`;
}

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

    const chunks = filterRelevantSources(await retrieveRelevantChunks(chatbotId, question));

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
    const finalAnswer = answer || insufficientAnswer;
    const sources =
      finalAnswer === insufficientAnswer
        ? []
        : chunks.map((chunk) => ({
            fileName: chunk.fileName,
            chunkIndex: chunk.chunkIndex,
            preview: buildSourcePreview(chunk.content),
            score: chunk.score,
          }));

    const assistantMessage = await db.message.create({
      data: {
        conversationId,
        role: "assistant",
        content: finalAnswer,
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
