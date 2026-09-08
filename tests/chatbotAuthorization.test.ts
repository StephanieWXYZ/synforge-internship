import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  authenticationErrorResponse: vi.fn(),
  chatbotFindMany: vi.fn(),
  chatbotFindFirst: vi.fn(),
  chatbotCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireApiUser: mocks.requireApiUser,
  authenticationErrorResponse: mocks.authenticationErrorResponse,
}));

vi.mock("@/lib/db", () => ({
  db: {
    chatbot: {
      findMany: mocks.chatbotFindMany,
      findFirst: mocks.chatbotFindFirst,
      create: mocks.chatbotCreate,
    },
  },
}));

import { GET as getChatbots, POST as createChatbot } from "@/app/api/chatbots/route";
import { GET as getChatbot } from "@/app/api/chatbots/[id]/route";

describe("chatbot API authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiUser.mockResolvedValue({ id: "user-1" });
    mocks.authenticationErrorResponse.mockReturnValue(null);
  });

  it("returns a safe authentication response when the chatbot list is requested signed out", async () => {
    mocks.requireApiUser.mockRejectedValue(new Error("auth required"));
    mocks.authenticationErrorResponse.mockReturnValue(
      NextResponse.json({ error: "You must sign in to continue." }, { status: 401 }),
    );

    const response = await getChatbots();

    await expect(response.json()).resolves.toEqual({
      error: "You must sign in to continue.",
    });
    expect(response.status).toBe(401);
    expect(mocks.chatbotFindMany).not.toHaveBeenCalled();
  });

  it("lists only chatbots owned by the authenticated user", async () => {
    mocks.chatbotFindMany.mockResolvedValue([]);

    const response = await getChatbots();

    await expect(response.json()).resolves.toEqual({ chatbots: [] });
    expect(response.status).toBe(200);
    expect(mocks.chatbotFindMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { documents: true } } },
    });
  });

  it("creates chatbots under the authenticated user's owner id", async () => {
    mocks.chatbotCreate.mockResolvedValue({ id: "chatbot-1", userId: "user-1" });

    const response = await createChatbot(
      new Request("http://localhost/api/chatbots", {
        method: "POST",
        body: JSON.stringify({
          name: "Real Estate Assistant",
          domain: "Real Estate",
          description: "Answers lease questions.",
          systemPrompt: "Only answer from uploaded documents.",
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      chatbot: { id: "chatbot-1", userId: "user-1" },
    });
    expect(response.status).toBe(201);
    expect(mocks.chatbotCreate).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        name: "Real Estate Assistant",
        domain: "Real Estate",
        description: "Answers lease questions.",
        systemPrompt: "Only answer from uploaded documents.",
      },
    });
  });

  it("reads chatbot details only within the authenticated user's ownership boundary", async () => {
    mocks.chatbotFindFirst.mockResolvedValue({ id: "chatbot-1", userId: "user-1" });

    const response = await getChatbot(new Request("http://localhost/api/chatbots/chatbot-1"), {
      params: Promise.resolve({ id: "chatbot-1" }),
    });

    await expect(response.json()).resolves.toEqual({
      chatbot: { id: "chatbot-1", userId: "user-1" },
    });
    expect(response.status).toBe(200);
    expect(mocks.chatbotFindFirst).toHaveBeenCalledWith({
      where: { id: "chatbot-1", userId: "user-1" },
      include: {
        documents: { where: { userId: "user-1" }, orderBy: { createdAt: "desc" } },
        _count: { select: { chunks: true, conversations: true } },
      },
    });
  });

  it("returns a safe not-found response for another user's chatbot id", async () => {
    mocks.chatbotFindFirst.mockResolvedValue(null);

    const response = await getChatbot(new Request("http://localhost/api/chatbots/chatbot-2"), {
      params: Promise.resolve({ id: "chatbot-2" }),
    });

    await expect(response.json()).resolves.toEqual({ error: "Chatbot not found." });
    expect(response.status).toBe(404);
    expect(mocks.chatbotFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "chatbot-2", userId: "user-1" },
      }),
    );
  });
});
