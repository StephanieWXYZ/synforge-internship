import { describe, expect, it } from "vitest";

import { filterDocumentsByFileName } from "@/lib/documentList";

const documents = [
  { id: "doc-1", fileName: "Sample-Lease.txt" },
  { id: "doc-2", fileName: "insurance-policy.pdf" },
  { id: "doc-3", fileName: "Power-Station-Manual.docx" },
];

describe("filterDocumentsByFileName", () => {
  it("matches file names case-insensitively", () => {
    expect(filterDocumentsByFileName(documents, "LEASE")).toEqual([documents[0]]);
  });

  it("trims search text before filtering", () => {
    expect(filterDocumentsByFileName(documents, "  policy  ")).toEqual([documents[1]]);
  });

  it("returns all documents when the search text is cleared", () => {
    expect(filterDocumentsByFileName(documents, "")).toEqual(documents);
    expect(filterDocumentsByFileName(documents, "   ")).toEqual(documents);
  });

  it("returns no documents when no file names match", () => {
    expect(filterDocumentsByFileName(documents, "kitchen")).toEqual([]);
  });
});
