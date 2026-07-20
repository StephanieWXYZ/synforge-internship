import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  documentFindFirst: vi.fn(),
  documentDelete: vi.fn(),
  documentUpdate: vi.fn(),
  documentChunkDeleteMany: vi.fn(),
  documentChunkCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    document: {
      findFirst: mocks.documentFindFirst,
      delete: mocks.documentDelete,
      update: mocks.documentUpdate,
    },
    documentChunk: {
      deleteMany: mocks.documentChunkDeleteMany,
      create: mocks.documentChunkCreate,
    },
  },
}));

import { deleteDocument, reprocessDocument } from "@/lib/documents";
import { DOCUMENT_ERROR_MESSAGES } from "@/lib/documentErrors";

describe("document isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not delete Chatbot A's document through Chatbot B", async () => {
    mocks.documentFindFirst.mockResolvedValue(null);

    await expect(deleteDocument("user-1", "chatbot-b", "document-a")).rejects.toThrow(
      DOCUMENT_ERROR_MESSAGES.documentNotFound,
    );

    expect(mocks.documentFindFirst).toHaveBeenCalledWith({
      where: { id: "document-a", chatbotId: "chatbot-b", userId: "user-1" },
    });
    expect(mocks.documentDelete).not.toHaveBeenCalled();
  });

  it("does not reprocess Chatbot A's document through Chatbot B", async () => {
    mocks.documentFindFirst.mockResolvedValue(null);

    await expect(reprocessDocument("user-1", "chatbot-b", "document-a")).rejects.toThrow(
      DOCUMENT_ERROR_MESSAGES.documentNotFound,
    );

    expect(mocks.documentFindFirst).toHaveBeenCalledWith({
      where: { id: "document-a", chatbotId: "chatbot-b", userId: "user-1" },
    });
    expect(mocks.documentUpdate).not.toHaveBeenCalled();
    expect(mocks.documentChunkDeleteMany).not.toHaveBeenCalled();
    expect(mocks.documentChunkCreate).not.toHaveBeenCalled();
  });
});
