import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ChatInterface } from "@/components/ChatInterface";
import { db } from "@/lib/db";

type ChatPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ChatPage({ params }: ChatPageProps) {
  const { id } = await params;
  const chatbot = await db.chatbot.findUnique({
    where: { id },
    include: { _count: { select: { documents: true, chunks: true } } },
  });

  if (!chatbot) {
    notFound();
  }

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
      <ChatInterface chatbotId={chatbot.id} />
    </main>
  );
}
