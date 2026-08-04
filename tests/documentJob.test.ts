import { describe, expect, it } from "vitest";

import { parseDocumentProcessingJob } from "@/lib/documentJob";

describe("document processing jobs", () => {
  it("parses the required ownership identifiers", () => {
    expect(
      parseDocumentProcessingJob(
        JSON.stringify({ documentId: "doc-1", userId: "user-1", chatbotId: "chatbot-1" }),
      ),
    ).toEqual({ documentId: "doc-1", userId: "user-1", chatbotId: "chatbot-1" });
  });

  it("rejects incomplete queue messages", () => {
    expect(() => parseDocumentProcessingJob('{"documentId":"doc-1"}')).toThrow(
      "missing required identifiers",
    );
  });
});
