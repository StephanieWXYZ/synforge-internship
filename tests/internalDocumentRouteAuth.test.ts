import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyWorkerRequest: vi.fn(),
  processQueuedDocument: vi.fn(),
}));

vi.mock("@/lib/workerAuth", () => ({ verifyWorkerRequest: mocks.verifyWorkerRequest }));
vi.mock("@/lib/documents", () => ({ processQueuedDocument: mocks.processQueuedDocument }));

import { POST } from "@/app/api/internal/documents/process/route";

describe("internal document processing route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects requests without a valid worker signature", async () => {
    mocks.verifyWorkerRequest.mockResolvedValue(false);
    const response = await POST(new Request("https://example.test/api/internal/documents/process", {
      method: "POST",
      body: "{}",
    }));
    expect(response.status).toBe(401);
    expect(mocks.processQueuedDocument).not.toHaveBeenCalled();
  });

  it("processes an authenticated queue job", async () => {
    mocks.verifyWorkerRequest.mockResolvedValue(true);
    mocks.processQueuedDocument.mockResolvedValue({ id: "doc-1", status: "ready" });
    const body = JSON.stringify({
      documentId: "doc-1",
      userId: "user-1",
      chatbotId: "chatbot-1",
    });
    const response = await POST(new Request("https://example.test/api/internal/documents/process", {
      method: "POST",
      body,
    }));
    expect(response.status).toBe(200);
    expect(mocks.processQueuedDocument).toHaveBeenCalledWith("user-1", "chatbot-1", "doc-1");
  });
});
