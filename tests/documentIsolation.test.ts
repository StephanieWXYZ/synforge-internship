import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  documentFindFirst: vi.fn(),
  documentDelete: vi.fn(),
  documentUpdate: vi.fn(),
  documentChunkFindMany: vi.fn(),
  documentChunkDeleteMany: vi.fn(),
  documentChunkCreate: vi.fn(),
  removeStoredDocument: vi.fn(),
  vectorDelete: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    document: {
      findFirst: mocks.documentFindFirst,
      delete: mocks.documentDelete,
      update: mocks.documentUpdate,
    },
    documentChunk: {
      findMany: mocks.documentChunkFindMany,
      deleteMany: mocks.documentChunkDeleteMany,
      create: mocks.documentChunkCreate,
    },
  },
}));

vi.mock("@/lib/documentStorage", () => ({
  createDocumentStoragePath: vi.fn(),
  createDocumentUploadUrl: vi.fn(),
  getStoredDocumentSize: vi.fn(),
  readStoredDocument: vi.fn(),
  removeStoredDocument: mocks.removeStoredDocument,
  storeDocument: vi.fn(),
  usesRemoteDocumentStorage: vi.fn(),
}));

vi.mock("@/lib/documentQueue", () => ({
  enqueueDocumentProcessing: vi.fn(),
  usesDocumentQueue: vi.fn(),
}));

vi.mock("@/lib/vectorStore", () => ({
  getEmbeddingVersion: vi.fn(() => "test-v1"),
  getVectorStore: vi.fn(() => ({
    delete: mocks.vectorDelete,
    upsert: vi.fn(),
  })),
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

  it("deletes a document, its chunks, vectors, and stored file within the selected chatbot", async () => {
    const document = {
      id: "document-a",
      userId: "user-1",
      chatbotId: "chatbot-a",
      fileName: "lease.txt",
      fileType: "text/plain",
      filePath: "/app/uploads/lease.txt",
      status: "ready",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mocks.documentFindFirst.mockResolvedValue(document);
    mocks.documentChunkFindMany.mockResolvedValue([
      { id: "chunk-1" },
      { id: "chunk-2" },
    ]);
    mocks.vectorDelete.mockResolvedValue(undefined);
    mocks.documentChunkDeleteMany.mockResolvedValue({ count: 2 });
    mocks.removeStoredDocument.mockResolvedValue(undefined);
    mocks.documentDelete.mockResolvedValue(document);

    await expect(deleteDocument("user-1", "chatbot-a", "document-a")).resolves.toEqual(document);

    expect(mocks.documentFindFirst).toHaveBeenCalledWith({
      where: { id: "document-a", chatbotId: "chatbot-a", userId: "user-1" },
    });
    expect(mocks.documentChunkFindMany).toHaveBeenCalledWith({
      where: { documentId: "document-a", chatbotId: "chatbot-a", userId: "user-1" },
    });
    expect(mocks.vectorDelete).toHaveBeenCalledWith(["chunk-1", "chunk-2"]);
    expect(mocks.documentChunkDeleteMany).toHaveBeenCalledWith({
      where: { documentId: "document-a", chatbotId: "chatbot-a", userId: "user-1" },
    });
    expect(mocks.removeStoredDocument).toHaveBeenCalledWith("/app/uploads/lease.txt");
    expect(mocks.documentDelete).toHaveBeenCalledWith({ where: { id: "document-a" } });
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
