import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  authenticationErrorResponse: vi.fn(),
  chatbotFindMany: vi.fn(),
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
      create: mocks.chatbotCreate,
    },
  },
}));

import { POST } from "@/app/api/chatbots/route";

describe("chatbot creation validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiUser.mockResolvedValue({ id: "user-1" });
    mocks.authenticationErrorResponse.mockReturnValue(null);
  });

  it("returns field-level errors for missing required fields", async () => {
    const response = await POST(
      new Request("http://localhost/api/chatbots", {
        method: "POST",
        body: JSON.stringify({
          name: "",
          domain: "Real Estate",
          description: "",
          systemPrompt: "",
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: "Please fix the highlighted fields.",
      fieldErrors: {
        name: "Name is required.",
        description: "Description is required.",
        systemPrompt: "System prompt/instructions are required.",
      },
    });
    expect(response.status).toBe(400);
    expect(mocks.chatbotCreate).not.toHaveBeenCalled();
  });
});
