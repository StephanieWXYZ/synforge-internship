import { parseDocumentProcessingJob } from "../src/lib/documentJob";
import { signWorkerRequest } from "../src/lib/workerAuth";

type SqsEvent = {
  Records?: Array<{ messageId?: string; body?: string }>;
};

const PROCESSING_PATH = "/api/internal/documents/process";

export async function handler(event: SqsEvent) {
  const batchItemFailures: Array<{ itemIdentifier: string }> = [];

  for (const record of event.Records ?? []) {
    const messageId = record.messageId ?? "unknown";
    try {
      if (!record.body) throw new Error("Document queue message body is empty.");
      const job = parseDocumentProcessingJob(record.body);
      const body = JSON.stringify(job);
      const auth = await signWorkerRequest(body);
      const origin = process.env.AMPLIFY_ORIGIN?.replace(/\/$/, "");
      if (!origin) throw new Error("AMPLIFY_ORIGIN is required.");

      const response = await fetch(`${origin}${PROCESSING_PATH}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-worker-signature": auth.signature,
          "x-worker-timestamp": auth.timestamp,
        },
        body,
        signal: AbortSignal.timeout(13 * 60 * 1000),
      });
      if (!response.ok) {
        throw new Error(`Document processing endpoint returned ${response.status}.`);
      }
    } catch (error) {
      console.error("Document processing dispatch failed", {
        messageId,
        error: error instanceof Error ? error.message : String(error),
      });
      batchItemFailures.push({ itemIdentifier: messageId });
    }
  }

  return { batchItemFailures };
}
