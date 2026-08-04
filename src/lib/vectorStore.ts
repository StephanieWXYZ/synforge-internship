import {
  DeleteVectorsCommand,
  PutVectorsCommand,
  QueryVectorsCommand,
  S3VectorsClient,
} from "@aws-sdk/client-s3vectors";

import { db } from "@/lib/db";
import { cosineSimilarity, parseEmbedding } from "@/lib/similarity";

export type VectorRecord = {
  chunkId: string;
  userId: string;
  chatbotId: string;
  documentId: string;
  embedding: number[];
  embeddingVersion: string;
};

export type VectorQuery = {
  userId: string;
  chatbotId: string;
  limit: number;
  getQueryVector: () => Promise<number[]>;
};

export type VectorMatch = {
  chunkId: string;
  score: number;
};

export interface VectorStore {
  upsert(records: VectorRecord[]): Promise<void>;
  query(input: VectorQuery): Promise<VectorMatch[]>;
  delete(chunkIds: string[]): Promise<void>;
}

const S3_VECTOR_BATCH_SIZE = 100;

const databaseVectorStore: VectorStore = {
  async upsert() {},

  async query(input) {
    const chunks = await db.documentChunk.findMany({
      where: { chatbotId: input.chatbotId, userId: input.userId },
    });

    if (chunks.length === 0) {
      return [];
    }

    const queryVector = await input.getQueryVector();
    return chunks
      .map((chunk) => ({
        chunkId: chunk.id,
        score: cosineSimilarity(queryVector, parseEmbedding(chunk.embedding)),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, input.limit);
  },

  async delete() {},
};

let s3VectorsClient: S3VectorsClient | undefined;

function getS3VectorsClient() {
  s3VectorsClient ??= new S3VectorsClient({});
  return s3VectorsClient;
}

function getS3VectorIndex() {
  const vectorBucketName = process.env.VECTOR_BUCKET_NAME?.trim();
  const indexName = process.env.VECTOR_INDEX_NAME?.trim();
  if (!vectorBucketName || !indexName) {
    throw new Error(
      "VECTOR_BUCKET_NAME and VECTOR_INDEX_NAME are required when VECTOR_STORE=s3-vectors.",
    );
  }
  return { vectorBucketName, indexName };
}

function validateDimension(chunkId: string, embedding: number[]) {
  const expectedDimension = Number(process.env.VECTOR_DIMENSION || 1536);
  if (!Number.isInteger(expectedDimension) || expectedDimension < 1) {
    throw new Error("VECTOR_DIMENSION must be a positive integer.");
  }
  if (embedding.length !== expectedDimension) {
    throw new Error(
      `Embedding for chunk ${chunkId} has ${embedding.length} dimensions; expected ${expectedDimension}.`,
    );
  }
}

export function getEmbeddingVersion() {
  return process.env.VECTOR_EMBEDDING_VERSION?.trim() || "v1";
}

const s3VectorStore: VectorStore = {
  async upsert(records) {
    if (records.length === 0) return;
    const index = getS3VectorIndex();

    for (let offset = 0; offset < records.length; offset += S3_VECTOR_BATCH_SIZE) {
      const batch = records.slice(offset, offset + S3_VECTOR_BATCH_SIZE);
      for (const record of batch) {
        validateDimension(record.chunkId, record.embedding);
      }

      await getS3VectorsClient().send(
        new PutVectorsCommand({
          ...index,
          vectors: batch.map((record) => ({
            key: record.chunkId,
            data: { float32: record.embedding },
            metadata: {
              userId: record.userId,
              chatbotId: record.chatbotId,
              documentId: record.documentId,
              embeddingVersion: record.embeddingVersion,
            },
          })),
        }),
      );
    }
  },

  async query(input) {
    const queryVector = await input.getQueryVector();
    validateDimension("query", queryVector);
    const response = await getS3VectorsClient().send(
      new QueryVectorsCommand({
        ...getS3VectorIndex(),
        queryVector: { float32: queryVector },
        topK: input.limit,
        filter: {
          $and: [
            { userId: input.userId },
            { chatbotId: input.chatbotId },
            { embeddingVersion: getEmbeddingVersion() },
          ],
        },
        returnDistance: true,
      }),
    );

    return (response.vectors ?? []).flatMap((vector) =>
      vector.key
        ? [{
            chunkId: vector.key,
            score: vector.distance === undefined ? 0 : 1 - vector.distance,
          }]
        : [],
    );
  },

  async delete(chunkIds) {
    if (chunkIds.length === 0) return;
    const index = getS3VectorIndex();
    for (let offset = 0; offset < chunkIds.length; offset += S3_VECTOR_BATCH_SIZE) {
      await getS3VectorsClient().send(
        new DeleteVectorsCommand({
          ...index,
          keys: chunkIds.slice(offset, offset + S3_VECTOR_BATCH_SIZE),
        }),
      );
    }
  },
};

export function getVectorStore(): VectorStore {
  const backend = process.env.VECTOR_STORE?.trim() || "database";
  if (backend === "database") return databaseVectorStore;
  if (backend === "s3-vectors") return s3VectorStore;
  throw new Error(`Unsupported VECTOR_STORE value: ${backend}.`);
}
