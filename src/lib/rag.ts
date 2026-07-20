import type { RetrievedChunk } from "@/lib/retrieval";

export const NO_ANSWER_FALLBACK =
  "I don't have enough information in the uploaded documents to answer that.";

const SOURCE_PREVIEW_MAX_LENGTH = 220;
const SOURCE_PREVIEW_ELLIPSIS = "...";

export type SourceReference = {
  fileName: string;
  chunkIndex: number;
  preview: string;
  score: number;
};

export function buildSourcePreview(content: string) {
  const preview = content.replace(/\s+/g, " ").trim();
  if (preview.length <= SOURCE_PREVIEW_MAX_LENGTH) {
    return preview;
  }

  const previewTextLength = SOURCE_PREVIEW_MAX_LENGTH - SOURCE_PREVIEW_ELLIPSIS.length;

  return `${preview.slice(0, previewTextLength).trimEnd().replace(/[.,;:!?]+$/, "")}${SOURCE_PREVIEW_ELLIPSIS}`;
}

export function buildSourceReferences(chunks: RetrievedChunk[]): SourceReference[] {
  return chunks.map((chunk) => ({
    fileName: chunk.fileName,
    chunkIndex: chunk.chunkIndex,
    preview: buildSourcePreview(chunk.content),
    score: chunk.score,
  }));
}

export function buildDocumentOnlySystemPrompt(systemPrompt: string) {
  return [
    systemPrompt,
    "You are a domain-specific document assistant.",
    "Answer only with the uploaded document context provided.",
    `If the context is insufficient, say exactly: ${NO_ANSWER_FALLBACK}`,
    "Do not invent facts. Keep answers practical and concise.",
  ].join("\n");
}

export function buildDocumentQuestionPrompt(context: string, question: string) {
  return `Document context:\n${context}\n\nQuestion:\n${question}`;
}

export async function buildRagResponse(
  chunks: RetrievedChunk[],
  generateAnswer: () => Promise<string>,
) {
  if (chunks.length === 0) {
    return {
      answer: NO_ANSWER_FALLBACK,
      sources: [],
    };
  }

  const answer = (await generateAnswer()).trim() || NO_ANSWER_FALLBACK;

  return {
    answer,
    sources: answer === NO_ANSWER_FALLBACK ? [] : buildSourceReferences(chunks),
  };
}
