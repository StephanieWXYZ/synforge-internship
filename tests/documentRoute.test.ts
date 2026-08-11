import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  authenticationErrorResponse: vi.fn(),
  deleteDocument: vi.fn(),
  reprocessDocument: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireApiUser: mocks.requireApiUser,
  authenticationErrorResponse: mocks.authenticationErrorResponse,
}));

vi.mock("@/lib/documents", () => ({
  deleteDocument: mocks.deleteDocument,
  reprocessDocument: mocks.reprocessDocument,
}));

import { PATCH } from "@/app/api/documents/[id]/route";
import { DOCUMENT_ERROR_MESSAGES } from "@/lib/documentErrors";

describe("document route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiUser.mockResolvedValue({ id: "user-1" });
    mocks.authenticationErrorResponse.mockReturnValue(null);
  });

  it("returns a safe user-facing error when reprocessing fails internally", async () => {
    mocks.reprocessDocument.mockRejectedValue(new Error("Embedding provider timeout"));

    const response = await PATCH(
      new Request("http://localhost/api/documents/document-a?chatbotId=chatbot-a", {
        method: "PATCH",
      }),
      { params: Promise.resolve({ id: "document-a" }) },
    );

    await expect(response.json()).resolves.toEqual({
      error: DOCUMENT_ERROR_MESSAGES.reprocessFailed,
    });
    expect(response.status).toBe(400);
    expect(mocks.reprocessDocument).toHaveBeenCalledWith(
      "user-1",
      "chatbot-a",
      "document-a",
    );
  });

  it("keeps safe validation errors readable for reprocess requests", async () => {
    mocks.reprocessDocument.mockRejectedValue(
      new Error(DOCUMENT_ERROR_MESSAGES.reprocessOnlyFailed),
    );

    const response = await PATCH(
      new Request("http://localhost/api/documents/document-a?chatbotId=chatbot-a", {
        method: "PATCH",
      }),
      { params: Promise.resolve({ id: "document-a" }) },
    );

    await expect(response.json()).resolves.toEqual({
      error: DOCUMENT_ERROR_MESSAGES.reprocessOnlyFailed,
    });
    expect(response.status).toBe(400);
  });
});
