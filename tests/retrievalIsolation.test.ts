import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  generateEmbedding: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    documentChunk: {
      findMany: mocks.findMany,
    },
  },
}));

vi.mock("@/lib/llm", () => ({
  generateEmbedding: mocks.generateEmbedding,
}));

import { retrieveRelevantChunks } from "@/lib/retrieval";

describe("retrieveRelevantChunks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("only searches chunks for the selected chatbot and user", async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: "chunk-b",
        documentId: "doc-b",
        chunkIndex: 0,
        content: "Insurance policy content",
        embedding: "[1,0]",
        document: { fileName: "policy.txt" },
      },
    ]);
    mocks.generateEmbedding.mockResolvedValue([1, 0]);

    const chunks = await retrieveRelevantChunks("user-1", "chatbot-b", "What is covered?");

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { chatbotId: "chatbot-b", userId: "user-1" },
      include: { document: true },
    });
    expect(chunks).toEqual([
      {
        chunkId: "chunk-b",
        documentId: "doc-b",
        fileName: "policy.txt",
        chunkIndex: 0,
        content: "Insurance policy content",
        score: 1,
      },
    ]);
  });

  it("does not request an embedding when the selected chatbot has no chunks", async () => {
    mocks.findMany.mockResolvedValue([]);

    await expect(
      retrieveRelevantChunks("user-1", "chatbot-b", "How much is the rent?"),
    ).resolves.toEqual([]);
    expect(mocks.generateEmbedding).not.toHaveBeenCalled();
  });
});
