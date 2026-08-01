import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  conversationFindFirst: vi.fn(),
  documentFindFirst: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    conversation: {
      findFirst: mocks.conversationFindFirst,
    },
    document: {
      findFirst: mocks.documentFindFirst,
    },
  },
}));

import {
  findConversationForChatbot,
  findDocumentForChatbot,
} from "@/lib/resourceValidation";

describe("resource validation helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finds conversations only within the selected chatbot and user", async () => {
    mocks.conversationFindFirst.mockResolvedValue(null);

    await findConversationForChatbot("user-1", "chatbot-b", "conversation-a");

    expect(mocks.conversationFindFirst).toHaveBeenCalledWith({
      where: { id: "conversation-a", chatbotId: "chatbot-b", userId: "user-1" },
    });
  });

  it("finds documents only within the selected chatbot and user", async () => {
    mocks.documentFindFirst.mockResolvedValue(null);

    await findDocumentForChatbot("user-1", "chatbot-b", "document-a");

    expect(mocks.documentFindFirst).toHaveBeenCalledWith({
      where: { id: "document-a", chatbotId: "chatbot-b", userId: "user-1" },
    });
  });
});
