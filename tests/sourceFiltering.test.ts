import { describe, expect, it } from "vitest";

import {
  filterRelevantSources,
  MIN_RELEVANT_CHUNK_SCORE,
} from "../src/lib/sourceFiltering";

describe("filterRelevantSources", () => {
  it("keeps sources that meet the minimum relevant score", () => {
    const sources = [
      { id: "low", score: MIN_RELEVANT_CHUNK_SCORE - 0.01 },
      { id: "same", score: MIN_RELEVANT_CHUNK_SCORE },
      { id: "high", score: MIN_RELEVANT_CHUNK_SCORE + 0.01 },
    ];

    expect(filterRelevantSources(sources).map((source) => source.id)).toEqual([
      "same",
      "high",
    ]);
  });

  it("allows a custom minimum score", () => {
    expect(
      filterRelevantSources(
        [
          { id: "low", score: 0.4 },
          { id: "high", score: 0.6 },
        ],
        0.5,
      ),
    ).toEqual([{ id: "high", score: 0.6 }]);
  });
});
