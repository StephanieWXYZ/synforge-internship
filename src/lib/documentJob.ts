export type DocumentProcessingJob = {
  documentId: string;
  userId: string;
  chatbotId: string;
};

export function parseDocumentProcessingJob(value: string): DocumentProcessingJob {
  const parsed = JSON.parse(value) as Partial<DocumentProcessingJob>;
  if (!parsed.documentId || !parsed.userId || !parsed.chatbotId) {
    throw new Error("Document processing job is missing required identifiers.");
  }
  return {
    documentId: parsed.documentId,
    userId: parsed.userId,
    chatbotId: parsed.chatbotId,
  };
}
