import { describe, expect, it } from "vitest";

import { chunkText } from "../src/lib/chunking";

describe("chunkText", () => {
  it("splits long text into overlapping chunks", () => {
    const text = Array.from({ length: 80 }, (_, index) => `Sentence ${index} has useful detail.`).join(
      " ",
    );

    const chunks = chunkText(text, { targetSize: 220, overlap: 40, minSize: 40 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[1].chunkIndex).toBe(1);
    expect(chunks.every((chunk) => chunk.content.length > 0)).toBe(true);
    expect(chunks[1].content).toContain("Sentence");
  });

  it("ignores empty input", () => {
    expect(chunkText(" \n\n\t ")).toEqual([]);
  });

  it("always advances when an early paragraph boundary is shorter than the overlap", () => {
    const text = `${"A".repeat(100)}\n\n${"B".repeat(5_000)}`;
    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.length).toBeLessThan(10);
    expect(chunks.at(-1)?.content).toContain("B");
  });
});
