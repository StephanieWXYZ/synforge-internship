import { describe, expect, it } from "vitest";

import { canReprocessDocument } from "@/lib/documentStatus";

describe("document processing status", () => {
  it("allows only failed documents to be reprocessed", () => {
    expect(canReprocessDocument("failed")).toBe(true);
  });

  it("does not allow active, queued, uploaded, or ready documents to be reprocessed", () => {
    expect(canReprocessDocument("processing")).toBe(false);
    expect(canReprocessDocument("queued")).toBe(false);
    expect(canReprocessDocument("uploaded")).toBe(false);
    expect(canReprocessDocument("ready")).toBe(false);
  });
});
