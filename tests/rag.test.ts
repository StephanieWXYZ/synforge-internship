import { describe, expect, it, vi } from "vitest";

import {
  buildDocumentOnlySystemPrompt,
  buildDocumentQuestionPrompt,
  buildRagResponse,
  buildSourcePreview,
  NO_ANSWER_FALLBACK,
} from "@/lib/rag";
import type { RetrievedChunk } from "@/lib/retrieval";

const chunk: RetrievedChunk = {
  chunkId: "chunk-a",
  documentId: "doc-a",
  fileName: "sample-lease.txt",
  chunkIndex: 2,
  content:
    "The tenant must pay rent on the first day of each month. The monthly rent amount is $2,000.",
  score: 0.82,
};

describe("buildRagResponse", () => {
  it("returns the fallback and does not call the model when no chunks are retrieved", async () => {
    const generateAnswer = vi.fn();

    await expect(buildRagResponse([], generateAnswer)).resolves.toEqual({
      answer: NO_ANSWER_FALLBACK,
      sources: [],
    });
    expect(generateAnswer).not.toHaveBeenCalled();
  });

  it("returns no sources when the model uses the fallback", async () => {
    await expect(
      buildRagResponse([chunk], vi.fn().mockResolvedValue(NO_ANSWER_FALLBACK)),
    ).resolves.toEqual({
      answer: NO_ANSWER_FALLBACK,
      sources: [],
    });
  });

  it("returns source references for supported answers", async () => {
    await expect(
      buildRagResponse([chunk], vi.fn().mockResolvedValue("The monthly rent amount is $2,000.")),
    ).resolves.toEqual({
      answer: "The monthly rent amount is $2,000.",
      sources: [
        {
          fileName: "sample-lease.txt",
          chunkIndex: 2,
          preview: chunk.content,
          score: 0.82,
        },
      ],
    });
  });
});

describe("RAG prompt helpers", () => {
  it("includes the document-only rule and exact fallback in the system prompt", () => {
    const prompt = buildDocumentOnlySystemPrompt("Only answer from real estate docs.");

    expect(prompt).toContain("Answer only with the uploaded document context provided.");
    expect(prompt).toContain(NO_ANSWER_FALLBACK);
  });

  it("places the retrieved context and question in the user prompt", () => {
    expect(buildDocumentQuestionPrompt("Lease context", "How much is rent?")).toBe(
      "Document context:\nLease context\n\nQuestion:\nHow much is rent?",
    );
  });

  it("keeps source previews short and readable", () => {
    const preview = buildSourcePreview(`${"Rent is due monthly. ".repeat(20)}Penalty.`);

    expect(preview.length).toBeLessThanOrEqual(220);
    expect(preview.endsWith("...")).toBe(true);
  });
});
