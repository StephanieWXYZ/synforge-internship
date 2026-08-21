import { describe, expect, it, vi } from "vitest";

import {
  buildDocumentOnlySystemPrompt,
  buildDocumentQuestionPrompt,
  buildRagResponse,
  buildSourcePreview,
  NO_ANSWER_FALLBACK,
  parseSourceReferences,
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
          documentId: "doc-a",
          fileName: "sample-lease.txt",
          chunkId: "chunk-a",
          chunkIndex: 2,
          preview: chunk.content,
          score: 0.82,
        },
      ],
    });
  });

  it("deduplicates repeated retrieved chunks", async () => {
    await expect(
      buildRagResponse(
        [chunk, { ...chunk, score: 0.8 }],
        vi.fn().mockResolvedValue("The monthly rent amount is $2,000."),
      ),
    ).resolves.toMatchObject({
      sources: [
        {
          documentId: "doc-a",
          chunkId: "chunk-a",
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

describe("parseSourceReferences", () => {
  it("returns an empty list for old messages without sources", () => {
    expect(parseSourceReferences(null)).toEqual([]);
    expect(parseSourceReferences("not json")).toEqual([]);
    expect(parseSourceReferences(JSON.stringify({ fileName: "lease.txt" }))).toEqual([]);
  });

  it("restores stored source references using the shared contract", () => {
    expect(
      parseSourceReferences(
        JSON.stringify([
          {
            documentId: "doc-a",
            fileName: "lease.txt",
            chunkId: "chunk-a",
            chunkIndex: 0,
            preview: "The monthly rent amount is $2,000.",
            score: 0.91,
          },
        ]),
      ),
    ).toEqual([
      {
        documentId: "doc-a",
        fileName: "lease.txt",
        chunkId: "chunk-a",
        chunkIndex: 0,
        preview: "The monthly rent amount is $2,000.",
        score: 0.91,
      },
    ]);
  });

  it("deduplicates repeated chunks and never exposes local file paths", () => {
    const sources = parseSourceReferences(
      JSON.stringify([
        {
          documentId: "doc-a",
          fileName: "lease.txt",
          filePath: "/Users/local/uploads/lease.txt",
          chunkId: "chunk-a",
          chunkIndex: 0,
          preview: "Rent is due on the first day of each month.",
          score: 0.91,
        },
        {
          documentId: "doc-a",
          fileName: "lease.txt",
          chunkId: "chunk-a",
          chunkIndex: 0,
          preview: "Duplicate source.",
          score: 0.9,
        },
      ]),
    );

    expect(sources).toEqual([
      {
        documentId: "doc-a",
        fileName: "lease.txt",
        chunkId: "chunk-a",
        chunkIndex: 0,
        preview: "Rent is due on the first day of each month.",
        score: 0.91,
      },
    ]);
    expect(JSON.stringify(sources)).not.toContain("filePath");
    expect(JSON.stringify(sources)).not.toContain("/Users/local/uploads/lease.txt");
  });

  it("limits restored previews", () => {
    const [source] = parseSourceReferences(
      JSON.stringify([
        {
          documentId: "doc-a",
          fileName: "lease.txt",
          chunkId: "chunk-a",
          chunkIndex: 0,
          preview: "Rent is due monthly. ".repeat(20),
        },
      ]),
    );

    expect(source.preview.length).toBeLessThanOrEqual(220);
    expect(source.preview.endsWith("...")).toBe(true);
  });
});
