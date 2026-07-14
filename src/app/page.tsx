import Link from "next/link";
import { Plus } from "lucide-react";

import { ChatbotCard } from "@/components/ChatbotCard";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function Home() {
  const user = await requireUser();
  const chatbots = await db.chatbot.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { documents: true } } },
  });

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-8 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Domain Knowledge Chatbot MVP
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Chatbots</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Create document-grounded assistants for real estate, insurance, legal,
            operations, education, or any other business domain.
          </p>
        </div>
        <Link
          href="/chatbots/new"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-blue-700 px-4 text-sm font-semibold text-white transition hover:bg-blue-800"
        >
          <Plus size={18} aria-hidden="true" />
          Create chatbot
        </Link>
      </div>

      {chatbots.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-lg font-semibold text-slate-950">No chatbots yet</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
            Start by creating a chatbot for a specific domain, then upload documents
            that the assistant is allowed to use.
          </p>
          <Link
            href="/chatbots/new"
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-blue-700 px-4 text-sm font-semibold text-white transition hover:bg-blue-800"
          >
            <Plus size={18} aria-hidden="true" />
            Create chatbot
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {chatbots.map((chatbot) => (
            <ChatbotCard key={chatbot.id} chatbot={chatbot} />
          ))}
        </div>
      )}
    </main>
  );
}
