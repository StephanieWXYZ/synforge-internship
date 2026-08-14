import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  chatbotFindFirst: vi.fn(),
  conversationFindFirst: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/db", () => ({
  db: {
    chatbot: { findFirst: mocks.chatbotFindFirst },
    conversation: { findFirst: mocks.conversationFindFirst },
  },
}));

import ChatPage from "@/app/chatbots/[id]/chat/page";
import { ChatInterface } from "@/components/ChatInterface";

function findElementByType(element: unknown, type: unknown): { props: Record<string, unknown> } | null {
  if (!element || typeof element !== "object") {
    return null;
  }

  const candidate = element as {
    type?: unknown;
    props?: { children?: unknown };
  };

  if (candidate.type === type) {
    return candidate as { props: Record<string, unknown> };
  }

  const children = candidate.props?.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findElementByType(child, type);
      if (found) {
        return found;
      }
    }
    return null;
  }

  return findElementByType(children, type);
}

describe("chat page conversations", () => {
  it("reopens the selected conversation and loads messages in chronological order", async () => {
    const user = { id: "user-1" };
    const firstMessageAt = new Date("2026-03-01T12:00:00Z");
    const secondMessageAt = new Date("2026-03-01T12:01:00Z");

    mocks.requireUser.mockResolvedValue(user);
    mocks.chatbotFindFirst.mockResolvedValue({
      id: "chatbot-b",
      name: "Insurance Assistant",
      domain: "Insurance",
      conversations: [
        {
          id: "conversation-b",
          title: "Coverage question",
          createdAt: new Date("2026-02-28T12:00:00Z"),
          messages: [{ createdAt: secondMessageAt }],
          _count: { messages: 2 },
        },
      ],
      _count: { documents: 1, chunks: 3 },
    });
    mocks.conversationFindFirst.mockResolvedValue({
      id: "conversation-b",
      messages: [
        {
          id: "message-1",
          role: "user",
          content: "What is covered?",
          sourcesJson: null,
          createdAt: firstMessageAt,
        },
        {
          id: "message-2",
          role: "assistant",
          content: "Coverage is described in the policy.",
          sourcesJson: JSON.stringify([{ fileName: "policy.pdf", chunkIndex: 0 }]),
          createdAt: secondMessageAt,
        },
      ],
    });

    const page = await ChatPage({
      params: Promise.resolve({ id: "chatbot-b" }),
      searchParams: Promise.resolve({ conversation: "conversation-b" }),
    });
    const chatInterface = findElementByType(page, ChatInterface);

    expect(mocks.chatbotFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "chatbot-b", userId: "user-1" },
      }),
    );
    expect(mocks.conversationFindFirst).toHaveBeenCalledWith({
      where: { id: "conversation-b", chatbotId: "chatbot-b", userId: "user-1" },
      include: { messages: { where: { userId: "user-1" }, orderBy: { createdAt: "asc" } } },
    });
    expect(chatInterface?.props.initialConversationId).toBe("conversation-b");
    expect(chatInterface?.props.initialMessages).toEqual([
      {
        id: "message-1",
        role: "user",
        content: "What is covered?",
        sources: [],
      },
      {
        id: "message-2",
        role: "assistant",
        content: "Coverage is described in the policy.",
        sources: [{ fileName: "policy.pdf", chunkIndex: 0 }],
      },
    ]);
  });
});
