import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageSquareText } from "lucide-react";

import { DocumentList } from "@/components/DocumentList";
import { FileUploader } from "@/components/FileUploader";
import { db } from "@/lib/db";

type ChatbotPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ChatbotPage({ params }: ChatbotPageProps) {
  const { id } = await params;
  const chatbot = await db.chatbot.findUnique({
    where: { id },
    include: {
      documents: { orderBy: { createdAt: "desc" } },
      _count: { select: { chunks: true } },
    },
  });

  if (!chatbot) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8">
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
        <ArrowLeft size={16} aria-hidden="true" />
        Back
      </Link>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            {chatbot.domain}
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">{chatbot.name}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            {chatbot.description}
          </p>
          <div className="mt-5 rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-950">Instructions</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
              {chatbot.systemPrompt}
            </p>
          </div>
        </section>

        <aside className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">Knowledge base</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md bg-slate-50 p-3">
              <dt className="text-slate-500">Documents</dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-950">
                {chatbot.documents.length}
              </dd>
            </div>
            <div className="rounded-md bg-slate-50 p-3">
              <dt className="text-slate-500">Chunks</dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-950">
                {chatbot._count.chunks}
              </dd>
            </div>
          </dl>
          <Link
            href={`/chatbots/${chatbot.id}/chat`}
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-blue-700 px-4 text-sm font-semibold text-white transition hover:bg-blue-800"
          >
            <MessageSquareText size={18} aria-hidden="true" />
            Open chat
          </Link>
        </aside>
      </div>

      <section className="mt-8 grid gap-5 lg:grid-cols-[420px_1fr]">
        <FileUploader chatbotId={chatbot.id} />
        <DocumentList documents={chatbot.documents} />
      </section>
    </main>
  );
}
