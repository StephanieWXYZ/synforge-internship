import { db } from "@/lib/db";
import { generateEmbedding } from "@/lib/llm";
import { cosineSimilarity, parseEmbedding } from "@/lib/similarity";

export type RetrievedChunk = {
  chunkId: string;
  documentId: string;
  fileName: string;
  chunkIndex: number;
  content: string;
  score: number;
};

export async function retrieveRelevantChunks(
  chatbotId: string,
  question: string,
  limit = 5,
): Promise<RetrievedChunk[]> {
  const chunks = await db.documentChunk.findMany({
    where: { chatbotId },
    include: { document: true },
  });

  if (chunks.length === 0) {
    return [];
  }

  const questionEmbedding = await generateEmbedding(question);

  return chunks
    .map((chunk) => ({
      chunkId: chunk.id,
      documentId: chunk.documentId,
      fileName: chunk.document.fileName,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      score: cosineSimilarity(questionEmbedding, parseEmbedding(chunk.embedding)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function buildContext(chunks: RetrievedChunk[]) {
  return chunks
    .map(
      (chunk) =>
        `[Source: ${chunk.fileName}, chunk ${chunk.chunkIndex + 1}]\n${chunk.content}`,
    )
    .join("\n\n---\n\n");
}
