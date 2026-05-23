import { mkdir, writeFile } from "node:fs/promises";
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

  try {
    await db.document.update({
      where: { id: document.id },
      data: { status: "processing" },
    });

    const text = await parseDocument(buffer, file.name, file.type);
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      throw new Error("No readable text was found in the document.");
    }

    for (const chunk of chunks) {
      const embedding = await generateEmbedding(chunk.content);
      await db.documentChunk.create({
        data: {
          documentId: document.id,
          chatbotId,
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
