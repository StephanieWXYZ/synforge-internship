import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ChatInterface } from "@/components/ChatInterface";
import { db } from "@/lib/db";
import { getSuggestedQuestions } from "@/lib/suggestedQuestions";

type ChatPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ conversation?: string }>;
};

type MessageSource = {
  fileName: string;
  chunkIndex: number;
  preview?: string;
  score?: number;
};

function parseSources(sourcesJson: string | null): MessageSource[] {
  if (!sourcesJson) {
    return [];
  }

  try {
    const sources = JSON.parse(sourcesJson);
    return Array.isArray(sources) ? sources : [];
  } catch {
    return [];
  }
}

export default async function ChatPage({ params, searchParams }: ChatPageProps) {
  const { id } = await params;
  const { conversation: selectedConversationId } = await searchParams;
  const chatbot = await db.chatbot.findUnique({
    where: { id },
    include: {
      conversations: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { messages: true } } },
      },
      _count: { select: { documents: true, chunks: true } },
    },
  });

  if (!chatbot) {
    notFound();
  }

  const selectedConversation = selectedConversationId
    ? await db.conversation.findFirst({
        where: { id: selectedConversationId, chatbotId: chatbot.id },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      })
    : null;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-8 sm:px-8">
      <Link
        href={`/chatbots/${chatbot.id}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back to chatbot
      </Link>
      <div className="my-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            {chatbot.domain}
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">{chatbot.name}</h1>
          <p className="mt-2 text-sm text-slate-500">
            {chatbot._count.documents} documents · {chatbot._count.chunks} chunks
          </p>
        </div>
      </div>
      <ChatInterface
        key={selectedConversation?.id ?? "new-conversation"}
        chatbotId={chatbot.id}
        conversations={chatbot.conversations.map((conversation) => ({
          id: conversation.id,
          title: conversation.title,
          createdAt: conversation.createdAt,
          messageCount: conversation._count.messages,
        }))}
        initialConversationId={selectedConversation?.id ?? ""}
        initialMessages={
          selectedConversation?.messages.map((message) => ({
            id: message.id,
            role: message.role === "assistant" ? "assistant" : "user",
            content: message.content,
            sources: parseSources(message.sourcesJson),
          })) ?? []
        }
        suggestedQuestions={getSuggestedQuestions(chatbot.name, chatbot.domain)}
      />
    </main>
  );
}
