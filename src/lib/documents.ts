import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { chunkText } from "@/lib/chunking";
import { db } from "@/lib/db";
import {
  isSupportedFile,
  MAX_FILE_SIZE,
  parseDocument,
} from "@/lib/documentParser";
import { generateEmbedding } from "@/lib/llm";

const uploadRoot = path.join(process.cwd(), "uploads");

type StoredDocument = {
  id: string;
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
      throw new Error("No readable text was found in the document.");
    }

    for (const chunk of chunks) {
      const embedding = await generateEmbedding(chunk.content);
      await db.documentChunk.create({
        data: {
          documentId: document.id,
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

export async function saveAndProcessDocument(chatbotId: string, file: File) {
  if (!isSupportedFile(file)) {
    throw new Error("Unsupported file type. Upload a PDF, TXT, or DOCX file.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File is too large. The MVP limit is 10 MB.");
  }

  const chatbot = await db.chatbot.findUnique({ where: { id: chatbotId } });
  if (!chatbot) {
    throw new Error("Chatbot not found.");
  }

  await mkdir(uploadRoot, { recursive: true });
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storedName = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const filePath = path.join(uploadRoot, storedName);
  const buffer = Buffer.from(await file.arrayBuffer());

  const document = await db.document.create({
    data: {
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

export async function reprocessDocument(documentId: string) {
  const document = await db.document.findUnique({ where: { id: documentId } });

  if (!document) {
    throw new Error("Document not found.");
  }

  if (document.status !== "failed") {
    throw new Error("Only failed documents can be reprocessed.");
  }

  const buffer = await readFile(document.filePath);
  return processStoredDocument(document, buffer);
}

export async function deleteDocument(documentId: string) {
  const document = await db.document.findUnique({ where: { id: documentId } });

  if (!document) {
    throw new Error("Document not found.");
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
