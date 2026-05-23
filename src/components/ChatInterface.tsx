"use client";

import { useState } from "react";
import { Send } from "lucide-react";

import { SourceReferences } from "@/components/SourceReferences";

type Source = {
  fileName: string;
  chunkIndex: number;
  score?: number;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
};

type ChatInterfaceProps = {
  chatbotId: string;
};

export function ChatInterface({ chatbotId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState("");
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) {
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };

    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setError("");
    setIsSending(true);

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatbotId, conversationId, question: trimmed }),
    });

    const data = (await response.json()) as {
      error?: string;
      conversationId?: string;
      message?: { id: string; role: "assistant"; content: string };
      sources?: Source[];
    };

    const assistantMessage = data.message;

    if (!response.ok || !assistantMessage) {
      setError(data.error ?? "Message failed.");
    } else {
      setConversationId(data.conversationId ?? conversationId);
      setMessages((current) => [
        ...current,
        {
          id: assistantMessage.id,
          role: "assistant",
          content: assistantMessage.content,
          sources: data.sources ?? [],
        },
      ]);
    }

    setIsSending(false);
  }

  return (
    <div className="flex min-h-[620px] flex-col rounded-lg border border-slate-200 bg-white">
      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Ask from uploaded files</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                Questions are answered only from documents attached to this chatbot.
              </p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[88%] rounded-lg px-4 py-3 text-sm leading-6 shadow-sm sm:max-w-[72%] ${
                  message.role === "user"
                    ? "bg-blue-700 text-white"
                    : "border border-slate-200 bg-slate-50 text-slate-800"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                {message.role === "assistant" ? (
                  <SourceReferences sources={message.sources ?? []} />
                ) : null}
              </div>
            </div>
          ))
        )}
        {isSending ? <p className="text-sm text-slate-500">Searching documents...</p> : null}
      </div>
      <form onSubmit={onSubmit} className="border-t border-slate-200 p-4">
        {error ? <p className="mb-3 text-sm text-rose-700">{error}</p> : null}
        <div className="flex gap-3">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask a question..."
            className="min-h-12 flex-1 rounded-md border border-slate-300 px-4 text-sm"
            disabled={isSending}
          />
          <button
            type="submit"
            disabled={isSending}
            className="inline-flex min-h-12 w-12 items-center justify-center rounded-md bg-blue-700 text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300"
            aria-label="Send message"
            title="Send message"
          >
            <Send size={18} aria-hidden="true" />
          </button>
        </div>
      </form>
    </div>
  );
}
