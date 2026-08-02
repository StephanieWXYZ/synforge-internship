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

import { reprocessDocument } from "@/lib/documents";

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
    mocks.documentChunkCreate.mockResolvedValue({});
    mocks.documentChunkFindMany.mockResolvedValue([]);
    mocks.documentChunkDeleteMany.mockResolvedValue({ count: 0 });
    mocks.documentUpdate.mockImplementation(async ({ data }: { data: { status: string } }) => ({
      ...document,
      ...data,
    }));

    await expect(reprocessDocument("user-a", "chatbot-a", "document-a")).resolves.toMatchObject({
      status: "ready",
    });

    expect(mocks.generateEmbeddings).toHaveBeenCalledTimes(3);
    expect(mocks.generateEmbeddings.mock.calls.map(([inputs]) => inputs.length)).toEqual([32, 32, 1]);
    expect(mocks.documentChunkCreate).toHaveBeenCalledTimes(65);
    expect(mocks.documentUpdate).toHaveBeenLastCalledWith({
      where: { id: "document-a" },
      data: { status: "ready" },
    });
  });
});
