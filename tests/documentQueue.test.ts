import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: class { send = mocks.send; },
  SendMessageCommand: class {
    input: unknown;
    constructor(input: unknown) { this.input = input; }
  },
}));

import { enqueueDocumentProcessing, usesDocumentQueue } from "@/lib/documentQueue";

describe("document queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DOCUMENT_QUEUE_URL = "https://sqs.example/document.fifo";
  });

  it("sends one FIFO message per document", async () => {
    mocks.send.mockResolvedValue({});
    await enqueueDocumentProcessing({
      documentId: "doc-1",
      userId: "user-1",
      chatbotId: "chatbot-1",
    });

    expect(usesDocumentQueue()).toBe(true);
    expect(mocks.send.mock.calls[0][0].input).toMatchObject({
      QueueUrl: "https://sqs.example/document.fifo",
      MessageGroupId: "doc-1",
      MessageBody: JSON.stringify({
        documentId: "doc-1",
        userId: "user-1",
        chatbotId: "chatbot-1",
      }),
    });
  });
});
