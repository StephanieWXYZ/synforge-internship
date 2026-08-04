import { describe, expect, it } from "vitest";

import { canReprocessDocument, STALE_PROCESSING_AFTER_MS } from "@/lib/documentStatus";

describe("document processing status", () => {
  it("allows failed and stalled documents to be reprocessed", () => {
    const now = Date.now();

    expect(canReprocessDocument("failed", new Date(now), now)).toBe(true);
    expect(
      canReprocessDocument(
        "processing",
        new Date(now - STALE_PROCESSING_AFTER_MS - 1),
        now,
      ),
    ).toBe(true);
    expect(
      canReprocessDocument("queued", new Date(now - STALE_PROCESSING_AFTER_MS - 1), now),
    ).toBe(true);
  });

  it("does not allow active or ready documents to be reprocessed", () => {
    const now = Date.now();

    expect(canReprocessDocument("processing", new Date(now), now)).toBe(false);
    expect(canReprocessDocument("queued", new Date(now), now)).toBe(false);
    expect(canReprocessDocument("ready", new Date(now - STALE_PROCESSING_AFTER_MS), now)).toBe(
      false,
    );
  });
});
