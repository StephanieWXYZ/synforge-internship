import path from "node:path";

import { chunkText } from "@/lib/chunking";
import { db } from "@/lib/db";
import { DOCUMENT_ERROR_MESSAGES } from "@/lib/documentErrors";
import { canReprocessDocument } from "@/lib/documentStatus";
import {
  createDocumentStoragePath,
  createDocumentUploadUrl,
  readStoredDocument,
  removeStoredDocument,
  storeDocument,
  usesRemoteDocumentStorage,
} from "@/lib/documentStorage";
import {
  isSupportedFile,
  isSupportedFileMetadata,
  MAX_FILE_SIZE,
  parseDocument,
} from "@/lib/documentParser";
import { generateEmbeddings } from "@/lib/llm";
import { findDocumentForChatbot } from "@/lib/resourceValidation";
import { getEmbeddingVersion, getVectorStore } from "@/lib/vectorStore";

type StoredDocument = {
  id: string;
  userId: string | null;
  chatbotId: string;
  fileName: string;
  fileType: string;
  filePath: string;
};

const EMBEDDING_BATCH_SIZE = 32;

export type DocumentUploadMetadata = {
  fileName: string;
  fileType: string;
  fileSize: number;
};

function validateUploadMetadata(metadata: DocumentUploadMetadata) {
  if (!metadata.fileName || !Number.isFinite(metadata.fileSize) || metadata.fileSize < 0) {
    throw new Error(DOCUMENT_ERROR_MESSAGES.missingUploadFields);
  }

  if (!isSupportedFileMetadata({ name: metadata.fileName, type: metadata.fileType })) {
    throw new Error(DOCUMENT_ERROR_MESSAGES.unsupportedFileType);
  }

  if (metadata.fileSize > MAX_FILE_SIZE) {
    throw new Error(DOCUMENT_ERROR_MESSAGES.fileTooLarge);
  }
}

async function requireOwnedChatbot(userId: string, chatbotId: string) {
  const chatbot = await db.chatbot.findFirst({ where: { id: chatbotId, userId } });
  if (!chatbot) {
    throw new Error(DOCUMENT_ERROR_MESSAGES.chatbotNotFound);
  }
}

async function createAndProcessDocument(
  userId: string,
  chatbotId: string,
  metadata: DocumentUploadMetadata,
  filePath: string,
  buffer: Buffer,
) {
  let document;
  try {
    document = await db.document.create({
      data: {
        userId,
        chatbotId,
        fileName: metadata.fileName,
        fileType: metadata.fileType || path.extname(metadata.fileName).slice(1),
        filePath,
        status: "uploaded",
      },
    });
  } catch (error) {
    await removeStoredDocument(filePath);
    throw error;
  }

  return processStoredDocument(document, buffer);
}

async function processStoredDocument(document: StoredDocument, buffer: Buffer) {
  await db.document.update({
    where: { id: document.id },
    data: { status: "processing" },
  });

  try {
    await deleteDocumentChunks(document);
    const text = await parseDocument(buffer, document.fileName, document.fileType);
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      throw new Error(DOCUMENT_ERROR_MESSAGES.noReadableText);
    }

    for (let offset = 0; offset < chunks.length; offset += EMBEDDING_BATCH_SIZE) {
      const batch = chunks.slice(offset, offset + EMBEDDING_BATCH_SIZE);
      const embeddings = await generateEmbeddings(batch.map((chunk) => chunk.content));

      const storedChunks = await Promise.all(
        batch.map((chunk, index) =>
          db.documentChunk.create({
            data: {
              documentId: document.id,
              userId: document.userId,
              chatbotId: document.chatbotId,
              chunkIndex: chunk.chunkIndex,
              content: chunk.content,
              embedding: JSON.stringify(embeddings[index]),
            },
          }),
        ),
      );
      if (!document.userId) {
        throw new Error("Document owner is required before indexing vectors.");
      }
      await getVectorStore().upsert(
        storedChunks.map((storedChunk, index) => ({
          chunkId: storedChunk.id,
          userId: document.userId as string,
          chatbotId: document.chatbotId,
          documentId: document.id,
          embedding: embeddings[index],
          embeddingVersion: getEmbeddingVersion(),
        })),
      );
    }

    return db.document.update({
      where: { id: document.id },
      data: { status: "ready" },
    });
  } catch (error) {
    await db.document.update({
      where: { id: document.id },
      data: { status: "failed" },
    });
    throw error;
  }
}

async function deleteDocumentChunks(document: StoredDocument) {
  const chunks = await db.documentChunk.findMany({
    where: {
      documentId: document.id,
      chatbotId: document.chatbotId,
      userId: document.userId,
    },
  });
  await getVectorStore().delete(chunks.map((chunk) => chunk.id));
  await db.documentChunk.deleteMany({ where: { documentId: document.id } });
}

export async function saveAndProcessDocument(userId: string, chatbotId: string, file: File) {
  if (!isSupportedFile(file)) {
    throw new Error(DOCUMENT_ERROR_MESSAGES.unsupportedFileType);
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(DOCUMENT_ERROR_MESSAGES.fileTooLarge);
  }

  await requireOwnedChatbot(userId, chatbotId);

  const filePath = createDocumentStoragePath(userId, chatbotId, file.name);
  const buffer = Buffer.from(await file.arrayBuffer());

  await storeDocument(filePath, buffer);

  return createAndProcessDocument(
    userId,
    chatbotId,
    { fileName: file.name, fileType: file.type, fileSize: file.size },
    filePath,
    buffer,
  );
}

export async function prepareDirectDocumentUpload(
  userId: string,
  chatbotId: string,
  metadata: DocumentUploadMetadata,
) {
  validateUploadMetadata(metadata);
  await requireOwnedChatbot(userId, chatbotId);

  if (!usesRemoteDocumentStorage()) {
    return { directUpload: false as const };
  }

  const filePath = createDocumentStoragePath(userId, chatbotId, metadata.fileName);
  const uploadUrl = await createDocumentUploadUrl(filePath, metadata.fileType);
  return { directUpload: true as const, filePath, uploadUrl };
}

export async function processDirectDocumentUpload(
  userId: string,
  chatbotId: string,
  metadata: DocumentUploadMetadata,
  filePath: string,
) {
  validateUploadMetadata(metadata);
  await requireOwnedChatbot(userId, chatbotId);

  if (!usesRemoteDocumentStorage()) {
    throw new Error("Direct document uploads require S3 storage.");
  }

  const expectedPrefix = `users/${userId}/chatbots/${chatbotId}/documents/`;
  if (!filePath.startsWith(expectedPrefix) || filePath.length <= expectedPrefix.length) {
    throw new Error(DOCUMENT_ERROR_MESSAGES.uploadFailed);
  }

  const buffer = await readStoredDocument(filePath);
  if (buffer.length !== metadata.fileSize || buffer.length > MAX_FILE_SIZE) {
    await removeStoredDocument(filePath);
    throw new Error(DOCUMENT_ERROR_MESSAGES.fileSizeMismatch);
  }

  return createAndProcessDocument(userId, chatbotId, metadata, filePath, buffer);
}

export async function reprocessDocument(userId: string, chatbotId: string, documentId: string) {
  const document = await findDocumentForChatbot(userId, chatbotId, documentId);

  if (!document) {
    throw new Error(DOCUMENT_ERROR_MESSAGES.documentNotFound);
  }

  if (!canReprocessDocument(document.status, document.createdAt)) {
    throw new Error(DOCUMENT_ERROR_MESSAGES.reprocessOnlyFailed);
  }

  const buffer = await readStoredDocument(document.filePath);
  return processStoredDocument(document, buffer);
}

export async function deleteDocument(userId: string, chatbotId: string, documentId: string) {
  const document = await findDocumentForChatbot(userId, chatbotId, documentId);

  if (!document) {
    throw new Error(DOCUMENT_ERROR_MESSAGES.documentNotFound);
  }

  await deleteDocumentChunks(document);
  await removeStoredDocument(document.filePath);

  return db.document.delete({ where: { id: document.id } });
}
