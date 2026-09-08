import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  chatbotFindMany: vi.fn(),
  chatbotFindFirst: vi.fn(),
  conversationFindFirst: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/db", () => ({
  db: {
    chatbot: {
      findMany: mocks.chatbotFindMany,
      findFirst: mocks.chatbotFindFirst,
    },
    conversation: {
      findFirst: mocks.conversationFindFirst,
    },
  },
}));

import Home from "@/app/page";
import NewChatbotPage from "@/app/chatbots/new/page";
import ChatbotPage from "@/app/chatbots/[id]/page";
import ChatPage from "@/app/chatbots/[id]/chat/page";

describe("protected pages", () => {
  it("blocks signed-out users before loading protected chatbot data", async () => {
    mocks.requireUser.mockRejectedValue(new Error("redirect /sign-in"));

    await expect(Home()).rejects.toThrow("redirect /sign-in");
    await expect(NewChatbotPage()).rejects.toThrow("redirect /sign-in");
    await expect(
      ChatbotPage({ params: Promise.resolve({ id: "chatbot-1" }) }),
    ).rejects.toThrow("redirect /sign-in");
    await expect(
      ChatPage({
        params: Promise.resolve({ id: "chatbot-1" }),
        searchParams: Promise.resolve({ conversation: "conversation-1" }),
      }),
    ).rejects.toThrow("redirect /sign-in");

    expect(mocks.chatbotFindMany).not.toHaveBeenCalled();
    expect(mocks.chatbotFindFirst).not.toHaveBeenCalled();
    expect(mocks.conversationFindFirst).not.toHaveBeenCalled();
  });
});
