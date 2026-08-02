import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signWorkerRequest: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/lib/workerAuth", () => ({ signWorkerRequest: mocks.signWorkerRequest }));

import { handler } from "../workers/documentProcessor";

describe("document queue dispatcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AMPLIFY_ORIGIN = "https://main.example.amplifyapp.com";
    mocks.signWorkerRequest.mockResolvedValue({ timestamp: "123", signature: "signed" });
    vi.stubGlobal("fetch", mocks.fetch);
  });

  it("dispatches a signed request to the protected processing route", async () => {
    mocks.fetch.mockResolvedValue({ ok: true, status: 200 });
    const body = JSON.stringify({
      documentId: "doc-1",
      userId: "user-1",
      chatbotId: "chatbot-1",
    });

    await expect(
      handler({ Records: [{ messageId: "message-1", body }] }),
    ).resolves.toEqual({ batchItemFailures: [] });
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://main.example.amplifyapp.com/api/internal/documents/process",
      expect.objectContaining({
        method: "POST",
        body,
        headers: expect.objectContaining({ "x-worker-signature": "signed" }),
      }),
    );
  });

  it("reports only the failed SQS message for retry", async () => {
    mocks.fetch.mockResolvedValue({ ok: false, status: 500 });
    const body = JSON.stringify({
      documentId: "doc-1",
      userId: "user-1",
      chatbotId: "chatbot-1",
    });
    await expect(
      handler({ Records: [{ messageId: "message-1", body }] }),
    ).resolves.toEqual({ batchItemFailures: [{ itemIdentifier: "message-1" }] });
  });
});
