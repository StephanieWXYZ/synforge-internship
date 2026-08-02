import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

import type { DocumentProcessingJob } from "@/lib/documentJob";

let sqsClient: SQSClient | undefined;

function getSqsClient() {
  sqsClient ??= new SQSClient({});
  return sqsClient;
}

export function usesDocumentQueue() {
  return Boolean(process.env.DOCUMENT_QUEUE_URL?.trim());
}

export async function enqueueDocumentProcessing(job: DocumentProcessingJob) {
  const queueUrl = process.env.DOCUMENT_QUEUE_URL?.trim();
  if (!queueUrl) {
    throw new Error("DOCUMENT_QUEUE_URL is required for asynchronous document processing.");
  }

  await getSqsClient().send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(job),
      MessageGroupId: job.documentId,
      MessageDeduplicationId: `${job.documentId}-${Date.now()}`,
    }),
  );
}
