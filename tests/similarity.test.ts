import { describe, expect, it } from "vitest";

import { cosineSimilarity, parseEmbedding } from "../src/lib/similarity";

describe("cosineSimilarity", () => {
  it("scores identical vectors as one", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it("scores orthogonal vectors as zero", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("returns zero for incompatible vectors", () => {
    expect(cosineSimilarity([1, 2], [1])).toBe(0);
  });
});

describe("parseEmbedding", () => {
  it("returns only numeric embedding values", () => {
    expect(parseEmbedding("[1,2,\"bad\",3]")).toEqual([1, 2, 3]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(parseEmbedding("not-json")).toEqual([]);
  });
});
