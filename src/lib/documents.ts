import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { chunkText } from "@/lib/chunking";
import { db } from "@/lib/db";
import { DOCUMENT_ERROR_MESSAGES } from "@/lib/documentErrors";
import {
  isSupportedFile,
  MAX_FILE_SIZE,
  parseDocument,
} from "@/lib/documentParser";
import { generateEmbedding } from "@/lib/llm";
import { findDocumentForChatbot } from "@/lib/resourceValidation";

const uploadRoot = path.join(process.cwd(), "uploads");

type StoredDocument = {
  id: string;
  userId: string | null;
  chatbotId: string;
  fileName: string;
  fileType: string;
  filePath: string;
};

async function processStoredDocument(document: StoredDocument, buffer: Buffer) {
  await db.document.update({
    where: { id: document.id },
    data: { status: "processing" },
  });

  await db.documentChunk.deleteMany({
    where: { documentId: document.id },
  });

  try {
    const text = await parseDocument(buffer, document.fileName, document.fileType);
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      throw new Error(DOCUMENT_ERROR_MESSAGES.noReadableText);
    }

    for (const chunk of chunks) {
      const embedding = await generateEmbedding(chunk.content);
      await db.documentChunk.create({
        data: {
          documentId: document.id,
          userId: document.userId,
          chatbotId: document.chatbotId,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          embedding: JSON.stringify(embedding),
        },
      });
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

export async function saveAndProcessDocument(userId: string, chatbotId: string, file: File) {
  if (!isSupportedFile(file)) {
    throw new Error(DOCUMENT_ERROR_MESSAGES.unsupportedFileType);
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(DOCUMENT_ERROR_MESSAGES.fileTooLarge);
  }

  const chatbot = await db.chatbot.findFirst({ where: { id: chatbotId, userId } });
  if (!chatbot) {
    throw new Error(DOCUMENT_ERROR_MESSAGES.chatbotNotFound);
  }

  await mkdir(uploadRoot, { recursive: true });
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storedName = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const filePath = path.join(uploadRoot, storedName);
  const buffer = Buffer.from(await file.arrayBuffer());

  const document = await db.document.create({
    data: {
      userId,
      chatbotId,
      fileName: file.name,
      fileType: file.type || path.extname(file.name).slice(1),
      filePath,
      status: "uploaded",
    },
  });

  await writeFile(filePath, buffer);

  return processStoredDocument(document, buffer);
}

export async function reprocessDocument(userId: string, chatbotId: string, documentId: string) {
  const document = await findDocumentForChatbot(userId, chatbotId, documentId);

  if (!document) {
    throw new Error(DOCUMENT_ERROR_MESSAGES.documentNotFound);
  }

  if (document.status !== "failed") {
    throw new Error(DOCUMENT_ERROR_MESSAGES.reprocessOnlyFailed);
  }

  const buffer = await readFile(document.filePath);
  return processStoredDocument(document, buffer);
}

export async function deleteDocument(userId: string, chatbotId: string, documentId: string) {
  const document = await findDocumentForChatbot(userId, chatbotId, documentId);

  if (!document) {
    throw new Error(DOCUMENT_ERROR_MESSAGES.documentNotFound);
  }

  try {
    await unlink(document.filePath);
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
      throw error;
    }
  }

  return db.document.delete({ where: { id: document.id } });
}
