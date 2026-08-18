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

  it("does not create an empty conversation when the question is blank", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          chatbotId: "chatbot-b",
          question: "   ",
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: "chatbotId and question are required.",
    });
    expect(response.status).toBe(400);
    expect(mocks.conversationCreate).not.toHaveBeenCalled();
    expect(mocks.messageCreate).not.toHaveBeenCalled();
  });

  it("creates a conversation only when the first message is sent", async () => {
    mocks.conversationCreate.mockResolvedValue({ id: "conversation-new" });
    mocks.retrieveRelevantChunks.mockResolvedValue([]);
    mocks.messageCreate
      .mockResolvedValueOnce({
        id: "user-message-1",
        conversationId: "conversation-new",
        role: "user",
        content: "What fees are mentioned?",
      })
      .mockResolvedValueOnce({
        id: "assistant-message-1",
        conversationId: "conversation-new",
        role: "assistant",
        content: "I don't have enough information in the uploaded documents to answer that.",
      });

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          chatbotId: "chatbot-b",
          question: "What fees are mentioned?",
        }),
      }),
    );

    await expect(response.json()).resolves.toMatchObject({
      conversationId: "conversation-new",
      userMessage: {
        id: "user-message-1",
        role: "user",
        content: "What fees are mentioned?",
      },
      message: {
        id: "assistant-message-1",
        role: "assistant",
      },
    });
    expect(response.status).toBe(200);
    expect(mocks.conversationCreate).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        chatbotId: "chatbot-b",
        title: "What fees are mentioned?",
      },
    });
    expect(mocks.findConversationForChatbot).not.toHaveBeenCalled();
    expect(mocks.messageCreate).toHaveBeenCalledTimes(2);
  });

  it("saves user and assistant messages with assistant sources", async () => {
    mocks.conversationCreate.mockResolvedValue({ id: "conversation-new" });
    mocks.retrieveRelevantChunks.mockResolvedValue([
      {
        chunkId: "chunk-1",
        documentId: "document-1",
        fileName: "lease.txt",
        chunkIndex: 0,
        content: "The tenant must give 60 days written notice before ending the lease early.",
        score: 0.92,
      },
    ]);
    mocks.generateChatAnswer.mockResolvedValue(
      "The tenant must give 60 days written notice before ending the lease early.",
    );
    mocks.messageCreate
      .mockResolvedValueOnce({
        id: "user-message-1",
        conversationId: "conversation-new",
        role: "user",
        content: "What notice is required?",
      })
      .mockResolvedValueOnce({
        id: "assistant-message-1",
        conversationId: "conversation-new",
        role: "assistant",
        content: "The tenant must give 60 days written notice before ending the lease early.",
      });

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          chatbotId: "chatbot-b",
          question: "What notice is required?",
        }),
      }),
    );

    await expect(response.json()).resolves.toMatchObject({
      conversationId: "conversation-new",
      sources: [
        expect.objectContaining({
          documentId: "document-1",
          fileName: "lease.txt",
          chunkId: "chunk-1",
          chunkIndex: 0,
          score: 0.92,
        }),
      ],
    });
    expect(response.status).toBe(200);
    expect(mocks.messageCreate).toHaveBeenNthCalledWith(1, {
      data: {
        userId: "user-1",
        conversationId: "conversation-new",
        role: "user",
        content: "What notice is required?",
      },
    });
    expect(mocks.messageCreate).toHaveBeenNthCalledWith(2, {
      data: {
        userId: "user-1",
        conversationId: "conversation-new",
        role: "assistant",
        content: "The tenant must give 60 days written notice before ending the lease early.",
        sourcesJson: expect.stringContaining("chunk-1"),
      },
    });
  });

  it("preserves the saved user message for retry when assistant generation fails", async () => {
    mocks.conversationCreate.mockResolvedValue({ id: "conversation-new" });
    mocks.retrieveRelevantChunks.mockResolvedValue([
      {
        chunkId: "chunk-1",
        documentId: "document-1",
        fileName: "lease.txt",
        chunkIndex: 0,
        content: "The monthly rent amount is $2,000.",
        score: 0.9,
      },
    ]);
    mocks.generateChatAnswer.mockRejectedValue(new Error("provider failed"));
    mocks.messageCreate.mockResolvedValueOnce({
      id: "user-message-1",
      conversationId: "conversation-new",
      role: "user",
      content: "How much is rent?",
    });

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          chatbotId: "chatbot-b",
          question: "How much is rent?",
        }),
      }),
    );

    await expect(response.json()).resolves.toMatchObject({
      error: "Assistant response failed. Please retry.",
      conversationId: "conversation-new",
      retryMessageId: "user-message-1",
      userMessage: {
        id: "user-message-1",
        role: "user",
        content: "How much is rent?",
      },
    });
    expect(response.status).toBe(500);
    expect(mocks.messageCreate).toHaveBeenCalledTimes(1);
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
    expect(mocks.conversationCreate).not.toHaveBeenCalled();
  });
});
