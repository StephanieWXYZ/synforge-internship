import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findDocumentForChatbot: vi.fn(),
  readStoredDocument: vi.fn(),
  parseDocument: vi.fn(),
  chunkText: vi.fn(),
  generateEmbeddings: vi.fn(),
  documentUpdate: vi.fn(),
  documentChunkDeleteMany: vi.fn(),
  documentChunkCreate: vi.fn(),
  documentChunkFindMany: vi.fn(),
  vectorDelete: vi.fn(),
  vectorUpsert: vi.fn(),
}));

vi.mock("@/lib/resourceValidation", () => ({
  findDocumentForChatbot: mocks.findDocumentForChatbot,
}));
vi.mock("@/lib/documentStorage", () => ({
  createDocumentStoragePath: vi.fn(),
  createDocumentUploadUrl: vi.fn(),
  readStoredDocument: mocks.readStoredDocument,
  removeStoredDocument: vi.fn(),
  storeDocument: vi.fn(),
  usesRemoteDocumentStorage: vi.fn(),
}));
vi.mock("@/lib/documentParser", () => ({
  isSupportedFile: vi.fn(),
  isSupportedFileMetadata: vi.fn(),
  MAX_FILE_SIZE: 10 * 1024 * 1024,
  parseDocument: mocks.parseDocument,
}));
vi.mock("@/lib/chunking", () => ({ chunkText: mocks.chunkText }));
vi.mock("@/lib/llm", () => ({ generateEmbeddings: mocks.generateEmbeddings }));
vi.mock("@/lib/db", () => ({
  db: {
    chatbot: { findFirst: vi.fn() },
    document: {
      create: vi.fn(),
      delete: vi.fn(),
      update: mocks.documentUpdate,
    },
    documentChunk: {
      deleteMany: mocks.documentChunkDeleteMany,
      create: mocks.documentChunkCreate,
      findMany: mocks.documentChunkFindMany,
    },
  },
}));
vi.mock("@/lib/vectorStore", () => ({
  getEmbeddingVersion: vi.fn(() => "test-v1"),
  getVectorStore: vi.fn(() => ({
    delete: mocks.vectorDelete,
    upsert: mocks.vectorUpsert,
  })),
}));

import { reprocessDocument } from "@/lib/documents";
import { DOCUMENT_ERROR_MESSAGES } from "@/lib/documentErrors";

describe("document processing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("embeds chunks in bounded batches before marking the document ready", async () => {
    const document = {
      id: "document-a",
      userId: "user-a",
      chatbotId: "chatbot-a",
      fileName: "book.pdf",
      fileType: "application/pdf",
      filePath: "document-a.pdf",
      status: "failed",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const chunks = Array.from({ length: 65 }, (_, chunkIndex) => ({
      chunkIndex,
      content: `Chunk ${chunkIndex}`,
    }));

    mocks.findDocumentForChatbot.mockResolvedValue(document);
    mocks.readStoredDocument.mockResolvedValue(Buffer.from("PDF"));
    mocks.parseDocument.mockResolvedValue("Parsed text");
    mocks.chunkText.mockReturnValue(chunks);
    mocks.generateEmbeddings.mockImplementation(async (inputs: string[]) =>
      inputs.map((_, index) => [index, 1]),
    );
    mocks.documentChunkCreate.mockImplementation(
      async ({ data }: { data: { chunkIndex: number } }) => ({
        id: `new-chunk-${data.chunkIndex}`,
        ...data,
      }),
    );
    mocks.documentChunkFindMany.mockResolvedValue([{ id: "old-chunk-1" }]);
    mocks.documentChunkDeleteMany.mockResolvedValue({ count: 0 });
    mocks.vectorDelete.mockResolvedValue(undefined);
    mocks.vectorUpsert.mockResolvedValue(undefined);
    mocks.documentUpdate.mockImplementation(async ({ data }: { data: { status: string } }) => ({
      ...document,
      ...data,
    }));

    await expect(reprocessDocument("user-a", "chatbot-a", "document-a")).resolves.toMatchObject({
      status: "ready",
    });

    expect(mocks.generateEmbeddings).toHaveBeenCalledTimes(3);
    expect(mocks.generateEmbeddings.mock.calls.map(([inputs]) => inputs.length)).toEqual([32, 32, 1]);
    expect(mocks.documentUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: "document-a" },
      data: { status: "processing" },
    });
    expect(mocks.vectorDelete).toHaveBeenCalledWith(["old-chunk-1"]);
    expect(mocks.documentChunkDeleteMany).toHaveBeenCalledWith({
      where: { documentId: "document-a", chatbotId: "chatbot-a", userId: "user-a" },
    });
    expect(mocks.documentChunkCreate).toHaveBeenCalledTimes(65);
    expect(mocks.documentChunkCreate).toHaveBeenNthCalledWith(1, {
      data: {
        documentId: "document-a",
        userId: "user-a",
        chatbotId: "chatbot-a",
        chunkIndex: 0,
        content: "Chunk 0",
        embedding: JSON.stringify([0, 1]),
      },
    });
    expect(mocks.vectorUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          chunkId: "new-chunk-0",
          userId: "user-a",
          chatbotId: "chatbot-a",
          documentId: "document-a",
        }),
      ]),
    );
    expect(mocks.documentUpdate).toHaveBeenLastCalledWith({
      where: { id: "document-a" },
      data: { status: "ready" },
    });
  });

  it("rejects reprocessing when the document is already processing", async () => {
    mocks.findDocumentForChatbot.mockResolvedValue({
      id: "document-a",
      userId: "user-a",
      chatbotId: "chatbot-a",
      fileName: "book.pdf",
      fileType: "application/pdf",
      filePath: "document-a.pdf",
      status: "processing",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(reprocessDocument("user-a", "chatbot-a", "document-a")).rejects.toThrow(
      DOCUMENT_ERROR_MESSAGES.reprocessOnlyFailed,
    );

    expect(mocks.documentUpdate).not.toHaveBeenCalled();
    expect(mocks.readStoredDocument).not.toHaveBeenCalled();
    expect(mocks.documentChunkDeleteMany).not.toHaveBeenCalled();
    expect(mocks.documentChunkCreate).not.toHaveBeenCalled();
  });

  it("marks the document failed when reprocessing fails", async () => {
    const document = {
      id: "document-a",
      userId: "user-a",
      chatbotId: "chatbot-a",
      fileName: "book.pdf",
      fileType: "application/pdf",
      filePath: "document-a.pdf",
      status: "failed",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mocks.findDocumentForChatbot.mockResolvedValue(document);
    mocks.readStoredDocument.mockResolvedValue(Buffer.from("PDF"));
    mocks.documentChunkFindMany.mockResolvedValue([]);
    mocks.documentChunkDeleteMany.mockResolvedValue({ count: 0 });
    mocks.vectorDelete.mockResolvedValue(undefined);
    mocks.parseDocument.mockRejectedValue(new Error("Parser failed"));
    mocks.documentUpdate.mockImplementation(async ({ data }: { data: { status: string } }) => ({
      ...document,
      ...data,
    }));

    await expect(reprocessDocument("user-a", "chatbot-a", "document-a")).rejects.toThrow(
      "Parser failed",
    );

    expect(mocks.documentUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: "document-a" },
      data: { status: "processing" },
    });
    expect(mocks.documentUpdate).toHaveBeenLastCalledWith({
      where: { id: "document-a" },
      data: { status: "failed" },
    });
  });
});
