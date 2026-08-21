"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquarePlus, Send } from "lucide-react";

import { SourceReferences } from "@/components/SourceReferences";
import type { SourceReference } from "@/lib/rag";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceReference[];
};

type FailedResponse = {
  conversationId: string;
  userMessageId: string;
};

type ConversationSummary = {
  id: string;
  title: string;
  createdAt: Date;
  activityAt: Date;
  messageCount: number;
};

type ChatInterfaceProps = {
  chatbotId: string;
  conversations: ConversationSummary[];
  initialConversationId: string;
  initialMessages: ChatMessage[];
  suggestedQuestions: string[];
};

export function ChatInterface({
  chatbotId,
  conversations,
  initialConversationId,
  initialMessages,
  suggestedQuestions,
}: ChatInterfaceProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [failedResponse, setFailedResponse] = useState<FailedResponse | null>(null);

  async function sendQuestion(questionToSend: string) {
    const trimmed = questionToSend.trim();
    if (!trimmed || isSending) {
      return;
    }

    const optimisticMessageId = crypto.randomUUID();
    const userMessage: ChatMessage = {
      id: optimisticMessageId,
      role: "user",
      content: trimmed,
    };

    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setError("");
    setFailedResponse(null);
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatbotId, conversationId, question: trimmed }),
      });

      const data = (await response.json()) as {
        error?: string;
        conversationId?: string;
        userMessage?: { id: string; role: "user"; content: string };
        retryMessageId?: string;
        message?: { id: string; role: "assistant"; content: string };
        sources?: SourceReference[];
      };

      const nextConversationId = data.conversationId ?? conversationId;
      if (data.userMessage) {
        setMessages((current) =>
          current.map((message) =>
            message.id === optimisticMessageId
              ? { ...message, id: data.userMessage?.id ?? message.id }
              : message,
          ),
        );
      }

      const assistantMessage = data.message;

      if (!response.ok || !assistantMessage) {
        setError(data.error ?? "Assistant response failed. Please retry.");

        if (data.retryMessageId && nextConversationId) {
          setConversationId(nextConversationId);
          setFailedResponse({
            conversationId: nextConversationId,
            userMessageId: data.retryMessageId,
          });
          if (nextConversationId !== conversationId) {
            router.replace(`/chatbots/${chatbotId}/chat?conversation=${nextConversationId}`);
          }
        } else {
          setMessages((current) =>
            current.filter((message) => message.id !== optimisticMessageId),
          );
          setQuestion(trimmed);
        }
        return;
      }

      setConversationId(nextConversationId);
      setMessages((current) => [
        ...current,
        {
          id: assistantMessage.id,
          role: "assistant",
          content: assistantMessage.content,
          sources: data.sources ?? [],
        },
      ]);
      if (nextConversationId && nextConversationId !== conversationId) {
        router.replace(`/chatbots/${chatbotId}/chat?conversation=${nextConversationId}`);
      }
      router.refresh();
    } catch {
      setMessages((current) => current.filter((message) => message.id !== optimisticMessageId));
      setQuestion(trimmed);
      setError("Message failed. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  async function retryAssistantResponse() {
    if (!failedResponse || isSending) {
      return;
    }

    setError("");
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatbotId,
          conversationId: failedResponse.conversationId,
          retryMessageId: failedResponse.userMessageId,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        conversationId?: string;
        message?: { id: string; role: "assistant"; content: string };
        sources?: SourceReference[];
      };

      if (!response.ok || !data.message) {
        setError(data.error ?? "Assistant response failed. Please retry.");
        return;
      }

      const nextConversationId = data.conversationId ?? failedResponse.conversationId;
      setConversationId(nextConversationId);
      setMessages((current) => [
        ...current,
        {
          id: data.message?.id ?? crypto.randomUUID(),
          role: "assistant",
          content: data.message?.content ?? "",
          sources: data.sources ?? [],
        },
      ]);
      setFailedResponse(null);
      router.refresh();
    } catch {
      setError("Assistant response failed. Please retry.");
    } finally {
      setIsSending(false);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendQuestion(question);
  }

  return (
    <div className="grid min-h-[620px] overflow-hidden rounded-lg border border-slate-200 bg-white lg:grid-cols-[280px_1fr]">
      <aside className="border-b border-slate-200 bg-slate-50 lg:border-b-0 lg:border-r">
        <div className="border-b border-slate-100 p-4">
          <Link
            href={`/chatbots/${chatbotId}/chat`}
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-blue-700 px-3 text-sm font-semibold text-white transition hover:bg-blue-800"
          >
            <MessageSquarePlus size={17} aria-hidden="true" />
            New conversation
          </Link>
        </div>
        <div className="max-h-[540px] overflow-y-auto p-2">
          {conversations.length === 0 ? (
            <div className="p-3 text-sm leading-6 text-slate-500">
              <p className="font-medium text-slate-700">No conversations yet</p>
              <p className="mt-1">Ask a question to start the first conversation.</p>
            </div>
          ) : (
            conversations.map((conversation) => (
              <Link
                key={conversation.id}
                href={`/chatbots/${chatbotId}/chat?conversation=${conversation.id}`}
                className={`block rounded-md px-3 py-2 text-sm transition ${
                  conversation.id === conversationId
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                }`}
              >
                <span className="line-clamp-2 font-medium">{conversation.title}</span>
                <span className="mt-1 block text-xs text-slate-500">
                  {conversation.messageCount} messages ·{" "}
                  {conversation.activityAt.toLocaleDateString()}
                </span>
              </Link>
            ))
          )}
        </div>
      </aside>

      <div className="flex min-h-[620px] flex-col bg-white">
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Ask from uploaded files</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Questions are answered only from documents attached to this chatbot.
                </p>
                {suggestedQuestions.length > 0 ? (
                  <div className="mt-5 grid gap-2 text-left sm:grid-cols-2">
                    {suggestedQuestions.map((suggestedQuestion) => (
                      <button
                        key={suggestedQuestion}
                        type="button"
                        onClick={() => setQuestion(suggestedQuestion)}
                        disabled={isSending}
                        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm leading-5 text-slate-700 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                      >
                        {suggestedQuestion}
                      </button>
                    ))}
                  </div>
                ) : null}
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
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  {message.role === "assistant" ? (
                    <SourceReferences sources={message.sources ?? []} />
                  ) : null}
                </div>
              </div>
            ))
          )}
          {isSending ? <p className="text-sm text-slate-500">Answering...</p> : null}
        </div>
        <form onSubmit={onSubmit} className="border-t border-slate-200 p-4">
          {error ? (
            <div className="mb-3 rounded-md border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <p>{error}</p>
              {failedResponse ? (
                <button
                  type="button"
                  onClick={retryAssistantResponse}
                  disabled={isSending}
                  className="mt-3 inline-flex min-h-9 items-center justify-center rounded-md bg-rose-700 px-3 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-rose-300"
                >
                  Retry response
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="flex gap-3">
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask a question..."
              className="min-h-12 min-w-0 flex-1 rounded-md border border-slate-300 px-4 text-sm"
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
    </div>
  );
}
