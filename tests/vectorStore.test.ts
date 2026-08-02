import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  send: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { documentChunk: { findMany: mocks.findMany } },
}));

vi.mock("@aws-sdk/client-s3vectors", () => {
  class Command {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  return {
    S3VectorsClient: class {
      send = mocks.send;
    },
    PutVectorsCommand: Command,
    QueryVectorsCommand: Command,
    DeleteVectorsCommand: Command,
  };
});

import { getVectorStore } from "@/lib/vectorStore";

describe("S3 vector store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VECTOR_STORE = "s3-vectors";
    process.env.VECTOR_BUCKET_NAME = "test-vectors";
    process.env.VECTOR_INDEX_NAME = "chunks-v1";
    process.env.VECTOR_DIMENSION = "2";
    process.env.VECTOR_EMBEDDING_VERSION = "test-v1";
  });

  it("writes tenant metadata alongside each vector", async () => {
    mocks.send.mockResolvedValue({});

    await getVectorStore().upsert([
      {
        chunkId: "chunk-1",
        userId: "user-1",
        chatbotId: "chatbot-1",
        documentId: "document-1",
        embedding: [0.25, 0.75],
        embeddingVersion: "test-v1",
      },
    ]);

    expect(mocks.send.mock.calls[0][0].input).toEqual({
      vectorBucketName: "test-vectors",
      indexName: "chunks-v1",
      vectors: [
        {
          key: "chunk-1",
          data: { float32: [0.25, 0.75] },
          metadata: {
            userId: "user-1",
            chatbotId: "chatbot-1",
            documentId: "document-1",
            embeddingVersion: "test-v1",
          },
        },
      ],
    });
  });

  it("enforces user and chatbot filters during vector search", async () => {
    mocks.send.mockResolvedValue({
      vectors: [{ key: "chunk-1", distance: 0.2 }],
    });

    await expect(
      getVectorStore().query({
        userId: "user-1",
        chatbotId: "chatbot-1",
        limit: 5,
        getQueryVector: async () => [1, 0],
      }),
    ).resolves.toEqual([{ chunkId: "chunk-1", score: 0.8 }]);

    expect(mocks.send.mock.calls[0][0].input).toMatchObject({
      topK: 5,
      filter: {
        $and: [
          { userId: "user-1" },
          { chatbotId: "chatbot-1" },
          { embeddingVersion: "test-v1" },
        ],
      },
      returnDistance: true,
    });
  });

  it("rejects embeddings with the wrong index dimension", async () => {
    await expect(
      getVectorStore().upsert([
        {
          chunkId: "chunk-1",
          userId: "user-1",
          chatbotId: "chatbot-1",
          documentId: "document-1",
          embedding: [1],
          embeddingVersion: "test-v1",
        },
      ]),
    ).rejects.toThrow("has 1 dimensions; expected 2");
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("deletes vectors by chunk id", async () => {
    mocks.send.mockResolvedValue({});
    await getVectorStore().delete(["chunk-1", "chunk-2"]);
    expect(mocks.send.mock.calls[0][0].input).toEqual({
      vectorBucketName: "test-vectors",
      indexName: "chunks-v1",
      keys: ["chunk-1", "chunk-2"],
    });
  });
});
