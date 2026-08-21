import { describe, expect, it } from "vitest";

import { SourceReferences } from "@/components/SourceReferences";
import type { SourceReference } from "@/lib/rag";

function isElement(value: unknown): value is {
  type: unknown;
  props: { children?: unknown; className?: string };
} {
  return Boolean(value && typeof value === "object" && "type" in value && "props" in value);
}

function collectByType(element: unknown, type: string): Array<{ props: Record<string, unknown> }> {
  if (Array.isArray(element)) {
    return element.flatMap((child) => collectByType(child, type));
  }

  if (!isElement(element)) {
    return [];
  }

  const matches = element.type === type ? [{ props: element.props as Record<string, unknown> }] : [];
  const children = element.props.children;

  if (Array.isArray(children)) {
    return matches.concat(children.flatMap((child) => collectByType(child, type)));
  }

  return matches.concat(collectByType(children, type));
}

function collectText(element: unknown): string {
  if (Array.isArray(element)) {
    return element.map(collectText).join("");
  }

  if (typeof element === "string" || typeof element === "number") {
    return String(element);
  }

  if (!isElement(element)) {
    return "";
  }

  const children = element.props.children;
  if (Array.isArray(children)) {
    return children.map(collectText).join("");
  }

  return collectText(children);
}

const source: SourceReference = {
  documentId: "document-1",
  fileName: "sample-lease.txt",
  chunkId: "chunk-1",
  chunkIndex: 0,
  preview: "The monthly rent amount is $2,000.",
  score: 0.92,
};

describe("SourceReferences", () => {
  it("renders a safe empty state when there are no sources", () => {
    const element = SourceReferences({ sources: [] });

    expect(collectText(element)).toContain("No source references saved for this response.");
    expect(collectByType(element, "details")).toHaveLength(0);
  });

  it("renders expandable references for one or more sources", () => {
    const element = SourceReferences({
      sources: [
        source,
        {
          ...source,
          documentId: "document-2",
          fileName: "policy.pdf",
          chunkId: "chunk-2",
          chunkIndex: 3,
          score: undefined,
        },
      ],
    });
    const text = collectText(element);

    expect(collectByType(element, "details")).toHaveLength(2);
    expect(text).toContain("Source references (2)");
    expect(text).toContain("sample-lease.txt");
    expect(text).toContain("chunk 1");
    expect(text).toContain("retrieval score 0.92");
    expect(text).toContain("Show preview");
    expect(text).toContain("Hide preview");
    expect(text).not.toMatch(/confidence|correctness/i);
  });

  it("keeps previews constrained so long text does not dominate the chat", () => {
    const longPreview = "Rent is due monthly. ".repeat(20);
    const element = SourceReferences({ sources: [{ ...source, preview: longPreview }] });
    const previewParagraph = collectByType(element, "p").find((paragraph) =>
      collectText(paragraph.props.children).includes("Rent is due monthly."),
    );

    expect(previewParagraph).toBeDefined();
    expect(previewParagraph?.props.className).toContain("max-h-32");
    expect(previewParagraph?.props.className).toContain("overflow-y-auto");
    expect(previewParagraph?.props.className).toContain("break-words");
  });
});
