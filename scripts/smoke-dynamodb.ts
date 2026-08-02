import assert from "node:assert/strict";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { BatchWriteCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

import { db } from "../src/lib/db";

const tableName = process.env.DYNAMODB_TABLE_NAME ?? "";
if (!tableName) {
  throw new Error("DYNAMODB_TABLE_NAME is required.");
}

const email = `smoke-${crypto.randomUUID()}@example.invalid`;
const cleanupKeys: string[] = [];

function remember(entity: string, id: string) {
  const key = `${entity.toUpperCase()}#${id}`;
  cleanupKeys.push(key);
  return id;
}

async function cleanup() {
  if (cleanupKeys.length === 0) return;

  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  await client.send(
    new BatchWriteCommand({
      RequestItems: {
        [tableName]: cleanupKeys.map((pk) => ({ DeleteRequest: { Key: { pk } } })),
      },
    }),
  );
}

async function main() {
  try {
  const user = await db.user.create({
    data: {
      email,
      name: "DynamoDB smoke test",
      passwordHash: "hash",
      passwordSalt: "salt",
    },
  });
  remember("email", email);
  remember("user", user.id);
  assert.equal((await db.user.findUnique({ where: { email } }))?.id, user.id);

  const session = await db.session.create({
    data: {
      id: remember("session", crypto.randomUUID()),
      userId: user.id,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  const sessionWithUser = await db.session.findUnique({
    where: { id: session.id },
    include: { user: true },
  });
  assert.equal(sessionWithUser?.user.id, user.id);

  const chatbot = await db.chatbot.create({
    data: {
      userId: user.id,
      name: "Smoke chatbot",
      domain: "Testing",
      description: "DynamoDB integration test",
      systemPrompt: "Answer test questions.",
    },
  });
  remember("chatbot", chatbot.id);
  assert.equal((await db.chatbot.findMany({ where: { userId: user.id } })).length, 1);

  const document = await db.document.create({
    data: {
      userId: user.id,
      chatbotId: chatbot.id,
      fileName: "smoke.txt",
      fileType: "text/plain",
      filePath: "/tmp/smoke.txt",
      status: "uploaded",
    },
  });
  remember("document", document.id);
  const chunk = await db.documentChunk.create({
    data: {
      userId: user.id,
      chatbotId: chatbot.id,
      documentId: document.id,
      chunkIndex: 0,
      content: "DynamoDB smoke content",
      embedding: "[1,0]",
    },
  });
  remember("chunk", chunk.id);
  const chunks = await db.documentChunk.findMany({
    where: { userId: user.id, chatbotId: chatbot.id },
    include: { document: true },
  });
  assert.equal(chunks[0]?.document.fileName, "smoke.txt");

  const conversation = await db.conversation.create({
    data: { userId: user.id, chatbotId: chatbot.id, title: "Smoke conversation" },
  });
  remember("conversation", conversation.id);
  const message = await db.message.create({
    data: {
      userId: user.id,
      conversationId: conversation.id,
      role: "user",
      content: "Smoke question",
    },
  });
  remember("message", message.id);
  assert.equal(
    (
      await db.message.findFirst({
        where: {
          id: message.id,
          userId: user.id,
          role: "user",
          conversation: { chatbotId: chatbot.id, userId: user.id },
        },
      })
    )?.id,
    message.id,
  );

  const chatbotDetails = await db.chatbot.findFirst({
    where: { id: chatbot.id, userId: user.id },
    include: {
      documents: { include: { _count: { select: { chunks: true } } } },
      conversations: { include: { _count: { select: { messages: true } } } },
      _count: { select: { documents: true, chunks: true, conversations: true } },
    },
  });
  assert.equal(chatbotDetails?.documents[0]?._count.chunks, 1);
  assert.equal(chatbotDetails?.conversations[0]?._count.messages, 1);
  assert.deepEqual(chatbotDetails?._count, { documents: 1, chunks: 1, conversations: 1 });

  await db.document.delete({ where: { id: document.id } });
  await db.session.deleteMany({ where: { id: session.id } });
  console.log("DynamoDB smoke test passed.");
  } finally {
    await cleanup();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
