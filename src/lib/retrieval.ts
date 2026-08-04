import { db } from "@/lib/db";
import { generateEmbedding } from "@/lib/llm";
import { getVectorStore } from "@/lib/vectorStore";

export type RetrievedChunk = {
  chunkId: string;
  documentId: string;
  fileName: string;
  chunkIndex: number;
  content: string;
  score: number;
};

export async function retrieveRelevantChunks(
  userId: string,
  chatbotId: string,
  question: string,
  limit = 5,
): Promise<RetrievedChunk[]> {
  const matches = await getVectorStore().query({
    userId,
    chatbotId,
    limit,
    getQueryVector: () => generateEmbedding(question),
  });

  if (matches.length === 0) {
    return [];
  }

  const chunks = await db.documentChunk.findMany({
    where: {
      id: { in: matches.map((match) => match.chunkId) },
      chatbotId,
      userId,
    },
    include: { document: true },
  });
  const chunksById = new Map(chunks.map((chunk) => [chunk.id, chunk]));

  return matches.flatMap((match) => {
    const chunk = chunksById.get(match.chunkId);
    if (!chunk) return [];
    return [{
      chunkId: chunk.id,
      documentId: chunk.documentId,
      fileName: chunk.document.fileName,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      score: match.score,
    }];
  });
}

export function buildContext(chunks: RetrievedChunk[]) {
  return chunks
    .map(
      (chunk) =>
        `[Source: ${chunk.fileName}, chunk ${chunk.chunkIndex + 1}]\n${chunk.content}`,
    )
    .join("\n\n---\n\n");
}
