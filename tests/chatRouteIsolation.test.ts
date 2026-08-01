import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  authenticationErrorResponse: vi.fn(),
  chatbotFindFirst: vi.fn(),
  conversationCreate: vi.fn(),
  messageCreate: vi.fn(),
  messageFindFirst: vi.fn(),
  findConversationForChatbot: vi.fn(),
  retrieveRelevantChunks: vi.fn(),
  generateChatAnswer: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireApiUser: mocks.requireApiUser,
  authenticationErrorResponse: mocks.authenticationErrorResponse,
}));

vi.mock("@/lib/db", () => ({
  db: {
    chatbot: {
      findFirst: mocks.chatbotFindFirst,
    },
    conversation: {
      create: mocks.conversationCreate,
    },
    message: {
      create: mocks.messageCreate,
      findFirst: mocks.messageFindFirst,
    },
  },
}));

vi.mock("@/lib/resourceValidation", () => ({
  findConversationForChatbot: mocks.findConversationForChatbot,
}));

vi.mock("@/lib/retrieval", async () => {
  const actual = await vi.importActual<typeof import("@/lib/retrieval")>("@/lib/retrieval");
  return {
    ...actual,
    retrieveRelevantChunks: mocks.retrieveRelevantChunks,
  };
});

vi.mock("@/lib/llm", () => ({
  generateChatAnswer: mocks.generateChatAnswer,
}));

import { POST } from "@/app/api/chat/route";

describe("chat route isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiUser.mockResolvedValue({ id: "user-1" });
    mocks.authenticationErrorResponse.mockReturnValue(null);
    mocks.chatbotFindFirst.mockResolvedValue({
      id: "chatbot-b",
      domain: "Insurance",
      description: "Insurance assistant",
      systemPrompt: "Only answer from uploaded insurance documents.",
    });
  });

  it("does not read or add messages to Chatbot A's conversation through Chatbot B", async () => {
    mocks.findConversationForChatbot.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          chatbotId: "chatbot-b",
          conversationId: "conversation-a",
          question: "How much is the monthly rent?",
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({ error: "Conversation not found." });
    expect(response.status).toBe(404);
    expect(mocks.findConversationForChatbot).toHaveBeenCalledWith(
      "user-1",
      "chatbot-b",
      "conversation-a",
    );
    expect(mocks.messageCreate).not.toHaveBeenCalled();
    expect(mocks.retrieveRelevantChunks).not.toHaveBeenCalled();
    expect(mocks.generateChatAnswer).not.toHaveBeenCalled();
  });

  it("retries an existing user message without creating a duplicate user message", async () => {
    mocks.messageFindFirst.mockResolvedValue({
      id: "user-message-1",
      conversationId: "conversation-b",
      role: "user",
      content: "How much is the monthly rent?",
    });
    mocks.findConversationForChatbot.mockResolvedValue({ id: "conversation-b" });
    mocks.retrieveRelevantChunks.mockResolvedValue([
      {
        chunkId: "chunk-b",
        documentId: "doc-b",
        fileName: "lease.txt",
        chunkIndex: 0,
        content: "The monthly rent amount is $2,000.",
        score: 0.9,
      },
    ]);
    mocks.generateChatAnswer.mockResolvedValue("The monthly rent amount is $2,000.");
    mocks.messageCreate.mockResolvedValue({
      id: "assistant-message-1",
      role: "assistant",
      content: "The monthly rent amount is $2,000.",
    });

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          chatbotId: "chatbot-b",
          conversationId: "conversation-b",
          retryMessageId: "user-message-1",
        }),
      }),
    );

    await expect(response.json()).resolves.toMatchObject({
      conversationId: "conversation-b",
      userMessage: {
        id: "user-message-1",
        role: "user",
        content: "How much is the monthly rent?",
      },
      message: {
        id: "assistant-message-1",
        role: "assistant",
        content: "The monthly rent amount is $2,000.",
      },
    });
    expect(response.status).toBe(200);
    expect(mocks.messageCreate).toHaveBeenCalledTimes(1);
    expect(mocks.messageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ role: "assistant" }),
    });
    expect(mocks.messageCreate).not.toHaveBeenCalledWith({
      data: expect.objectContaining({ role: "user" }),
    });
  });
});
