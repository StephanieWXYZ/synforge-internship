import type { RetrievedChunk } from "@/lib/retrieval";

export const NO_ANSWER_FALLBACK =
  "I don't have enough information in the uploaded documents to answer that.";

const SOURCE_PREVIEW_MAX_LENGTH = 220;
const SOURCE_PREVIEW_ELLIPSIS = "...";

export type SourceReference = {
  documentId: string;
  fileName: string;
  chunkId: string;
  chunkIndex: number;
  preview: string;
  score?: number;
};

function isSourceReference(value: unknown): value is SourceReference {
  if (!value || typeof value !== "object") {
    return false;
  }

  const source = value as Partial<SourceReference>;
  const hasScore = source.score === undefined || typeof source.score === "number";

  return (
    typeof source.documentId === "string" &&
    typeof source.fileName === "string" &&
    typeof source.chunkId === "string" &&
    typeof source.chunkIndex === "number" &&
    typeof source.preview === "string" &&
    hasScore
  );
}

function dedupeSourceReferences(sources: SourceReference[]) {
  const seenChunkIds = new Set<string>();

  return sources.filter((source) => {
    if (seenChunkIds.has(source.chunkId)) {
      return false;
    }

    seenChunkIds.add(source.chunkId);
    return true;
  });
}

export function buildSourcePreview(content: string) {
  const preview = content.replace(/\s+/g, " ").trim();
  if (preview.length <= SOURCE_PREVIEW_MAX_LENGTH) {
    return preview;
  }

  const previewTextLength = SOURCE_PREVIEW_MAX_LENGTH - SOURCE_PREVIEW_ELLIPSIS.length;

  return `${preview.slice(0, previewTextLength).trimEnd().replace(/[.,;:!?]+$/, "")}${SOURCE_PREVIEW_ELLIPSIS}`;
}

export function buildSourceReferences(chunks: RetrievedChunk[]): SourceReference[] {
  return dedupeSourceReferences(
    chunks.map((chunk) => ({
      documentId: chunk.documentId,
      fileName: chunk.fileName,
      chunkId: chunk.chunkId,
      chunkIndex: chunk.chunkIndex,
      preview: buildSourcePreview(chunk.content),
      score: chunk.score,
    })),
  );
}

export function parseSourceReferences(sourcesJson: string | null): SourceReference[] {
  if (!sourcesJson) {
    return [];
  }

  try {
    const parsedSources = JSON.parse(sourcesJson);
    if (!Array.isArray(parsedSources)) {
      return [];
    }

    const sources = parsedSources.flatMap((source): SourceReference[] => {
      if (!isSourceReference(source)) {
        return [];
      }

      return [
        {
          documentId: source.documentId,
          fileName: source.fileName,
          chunkId: source.chunkId,
          chunkIndex: source.chunkIndex,
          preview: buildSourcePreview(source.preview),
          ...(source.score === undefined ? {} : { score: source.score }),
        },
      ];
    });

    return dedupeSourceReferences(sources);
  } catch {
    return [];
  }
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
