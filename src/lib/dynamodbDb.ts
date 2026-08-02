import { randomUUID } from "node:crypto";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";

type Item = Record<string, unknown>;
type Where = Record<string, unknown>;
type Data = Record<string, unknown>;
type Include = Record<string, unknown>;

const OWNER_INDEX = "owner-index";
const RELATED_INDEX = "related-index";

function now() {
  return new Date().toISOString();
}

function entityKey(entity: string, id: string) {
  return `${entity.toUpperCase()}#${id}`;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asOptionalString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asDate(value: unknown) {
  return value instanceof Date ? value : new Date(asString(value));
}

function publicItem(item: Item | undefined): Record<string, unknown> | null {
  if (!item) return null;

  const result = { ...item };
  for (const key of [
    "pk",
    "entity",
    "ownerPk",
    "ownerSk",
    "relatedPk",
    "relatedSk",
    "expiresAtEpoch",
  ]) {
    delete result[key];
  }

  for (const key of ["createdAt", "updatedAt", "expiresAt"]) {
    if (typeof result[key] === "string") {
      result[key] = new Date(result[key]);
    }
  }

  return result;
}

export function createDynamoDb(tableName: string) {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  });

  async function get(entity: string, id: string) {
    const response = await client.send(
      new GetCommand({ TableName: tableName, Key: { pk: entityKey(entity, id) } }),
    );
    return response.Item as Item | undefined;
  }

  async function put(item: Item, conditionExpression?: string) {
    await client.send(
      new PutCommand({ TableName: tableName, Item: item, ConditionExpression: conditionExpression }),
    );
    return item;
  }

  async function queryIndex(
    indexName: string,
    partitionKey: "ownerPk" | "relatedPk",
    sortKey: "ownerSk" | "relatedSk",
    partitionValue: string,
    prefix: string,
    descending = false,
  ) {
    const response = await client.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: indexName,
        KeyConditionExpression: "#partition = :partition AND begins_with(#sort, :prefix)",
        ExpressionAttributeNames: { "#partition": partitionKey, "#sort": sortKey },
        ExpressionAttributeValues: { ":partition": partitionValue, ":prefix": prefix },
        ScanIndexForward: !descending,
      }),
    );
    return (response.Items ?? []) as Item[];
  }

  function queryOwner(ownerPk: string, prefix: string, descending = false) {
    return queryIndex(OWNER_INDEX, "ownerPk", "ownerSk", ownerPk, prefix, descending);
  }

  function queryRelated(relatedPk: string, prefix: string) {
    return queryIndex(RELATED_INDEX, "relatedPk", "relatedSk", relatedPk, prefix);
  }

  async function deleteItems(items: Item[]) {
    for (let offset = 0; offset < items.length; offset += 25) {
      const batch = items.slice(offset, offset + 25);
      await client.send(
        new BatchWriteCommand({
          RequestItems: {
            [tableName]: batch.map((item) => ({ DeleteRequest: { Key: { pk: item.pk } } })),
          },
        }),
      );
    }
  }

  async function chatbotWithIncludes(item: Item, include?: Include) {
    const chatbot = publicItem(item) as Record<string, unknown>;
    const chatbotId = asString(item.id);

    if (include?.documents) {
      const documentItems = await queryOwner(entityKey("chatbot", chatbotId), "DOCUMENT#", true);
      const documentInclude = (include.documents as { include?: Include }).include;
      chatbot.documents = await Promise.all(
        documentItems.map(async (documentItem) => {
          const document = publicItem(documentItem) as Record<string, unknown>;
          if (documentInclude?._count) {
            const chunks = await queryRelated(entityKey("document", asString(documentItem.id)), "CHUNK#");
            document._count = { chunks: chunks.length };
          }
          return document;
        }),
      );
    }

    if (include?.conversations) {
      const conversationItems = await queryOwner(
        entityKey("chatbot", chatbotId),
        "CONVERSATION#",
        true,
      );
      const conversationInclude = (include.conversations as { include?: Include }).include;
      chatbot.conversations = await Promise.all(
        conversationItems.map(async (conversationItem) => {
          const conversation = publicItem(conversationItem) as Record<string, unknown>;
          if (conversationInclude?._count) {
            const messages = await queryOwner(
              entityKey("conversation", asString(conversationItem.id)),
              "MESSAGE#",
            );
            conversation._count = { messages: messages.length };
          }
          return conversation;
        }),
      );
    }

    if (include?._count) {
      const [documents, chunks, conversations] = await Promise.all([
        queryOwner(entityKey("chatbot", chatbotId), "DOCUMENT#"),
        queryOwner(entityKey("chatbot", chatbotId), "CHUNK#"),
        queryOwner(entityKey("chatbot", chatbotId), "CONVERSATION#"),
      ]);
      chatbot._count = {
        documents: documents.length,
        chunks: chunks.length,
        conversations: conversations.length,
      };
    }

    return chatbot;
  }

  return {
    user: {
      async findUnique({ where }: { where: Where }) {
        if (where.id) return publicItem(await get("user", asString(where.id)));
        const email = asString(where.email).toLowerCase();
        const emailClaim = await get("email", email);
        return emailClaim ? publicItem(await get("user", asString(emailClaim.userId))) : null;
      },
      async create({ data }: { data: Data }) {
        const id = randomUUID();
        const createdAt = now();
        const email = asString(data.email).toLowerCase();
        const user = {
          pk: entityKey("user", id),
          entity: "User",
          id,
          email,
          name: asString(data.name),
          passwordHash: asString(data.passwordHash),
          passwordSalt: asString(data.passwordSalt),
          createdAt,
        };
        await client.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Put: {
                  TableName: tableName,
                  Item: { pk: entityKey("email", email), entity: "EmailClaim", userId: id },
                  ConditionExpression: "attribute_not_exists(pk)",
                },
              },
              {
                Put: {
                  TableName: tableName,
                  Item: user,
                  ConditionExpression: "attribute_not_exists(pk)",
                },
              },
            ],
          }),
        );
        return publicItem(user);
      },
    },
    session: {
      async create({ data }: { data: Data }) {
        const id = asString(data.id);
        const userId = asString(data.userId);
        const expiresAt = asDate(data.expiresAt);
        const item = {
          pk: entityKey("session", id),
          entity: "Session",
          id,
          userId,
          expiresAt: expiresAt.toISOString(),
          expiresAtEpoch: Math.floor(expiresAt.getTime() / 1000),
          createdAt: now(),
          ownerPk: entityKey("user", userId),
          ownerSk: entityKey("session", id),
        };
        await put(item, "attribute_not_exists(pk)");
        return publicItem(item);
      },
      async deleteMany({ where }: { where: Where }) {
        const id = asString(where.id);
        const existing = await get("session", id);
        if (!existing) return { count: 0 };
        await client.send(new DeleteCommand({ TableName: tableName, Key: { pk: existing.pk } }));
        return { count: 1 };
      },
      async findUnique({ where, include }: { where: Where; include?: Include }) {
        const sessionItem = await get("session", asString(where.id));
        if (!sessionItem) return null;
        const session = publicItem(sessionItem) as Record<string, unknown>;
        if (include?.user) {
          session.user = publicItem(await get("user", asString(sessionItem.userId)));
        }
        return session;
      },
    },
    chatbot: {
      async create({ data }: { data: Data }) {
        const id = randomUUID();
        const createdAt = now();
        const item = {
          pk: entityKey("chatbot", id),
          entity: "Chatbot",
          id,
          userId: asOptionalString(data.userId),
          name: asString(data.name),
          domain: asString(data.domain),
          description: asString(data.description),
          systemPrompt: asString(data.systemPrompt),
          createdAt,
          updatedAt: createdAt,
          ownerPk: entityKey("user", asString(data.userId)),
          ownerSk: `CHATBOT#${createdAt}#${id}`,
        };
        await put(item, "attribute_not_exists(pk)");
        return publicItem(item);
      },
      async findMany({ where, include }: { where: Where; include?: Include }) {
        const items = await queryOwner(entityKey("user", asString(where.userId)), "CHATBOT#", true);
        return Promise.all(items.map((item) => chatbotWithIncludes(item, include)));
      },
      async findFirst({ where, include }: { where: Where; include?: Include }) {
        const item = await get("chatbot", asString(where.id));
        if (!item || (where.userId && item.userId !== where.userId)) return null;
        return chatbotWithIncludes(item, include);
      },
    },
    document: {
      async create({ data }: { data: Data }) {
        const id = randomUUID();
        const createdAt = now();
        const item = {
          pk: entityKey("document", id),
          entity: "Document",
          id,
          userId: asOptionalString(data.userId),
          chatbotId: asString(data.chatbotId),
          fileName: asString(data.fileName),
          fileType: asString(data.fileType),
          filePath: asString(data.filePath),
          status: asString(data.status) || "uploaded",
          createdAt,
          updatedAt: createdAt,
          ownerPk: entityKey("chatbot", asString(data.chatbotId)),
          ownerSk: `DOCUMENT#${createdAt}#${id}`,
          relatedPk: entityKey("user", asString(data.userId)),
          relatedSk: `DOCUMENT#${createdAt}#${id}`,
        };
        await put(item, "attribute_not_exists(pk)");
        return publicItem(item);
      },
      async findFirst({ where }: { where: Where }) {
        const item = await get("document", asString(where.id));
        if (!item) return null;
        if (where.userId && item.userId !== where.userId) return null;
        if (where.chatbotId && item.chatbotId !== where.chatbotId) return null;
        return publicItem(item);
      },
      async update({ where, data }: { where: Where; data: Data }) {
        const item = await get("document", asString(where.id));
        if (!item) throw new Error("Document not found.");
        const updated = { ...item, ...data, updatedAt: now() };
        await put(updated);
        return publicItem(updated);
      },
      async delete({ where }: { where: Where }) {
        const id = asString(where.id);
        const item = await get("document", id);
        if (!item) throw new Error("Document not found.");
        const chunks = await queryRelated(entityKey("document", id), "CHUNK#");
        await deleteItems(chunks);
        await client.send(new DeleteCommand({ TableName: tableName, Key: { pk: item.pk } }));
        return publicItem(item);
      },
    },
    documentChunk: {
      async create({ data }: { data: Data }) {
        const id = randomUUID();
        const createdAt = now();
        const documentId = asString(data.documentId);
        const chunkIndex = Number(data.chunkIndex);
        const paddedIndex = String(chunkIndex).padStart(8, "0");
        const item = {
          pk: entityKey("chunk", id),
          entity: "DocumentChunk",
          id,
          userId: asOptionalString(data.userId),
          documentId,
          chatbotId: asString(data.chatbotId),
          chunkIndex,
          content: asString(data.content),
          embedding: asString(data.embedding),
          createdAt,
          ownerPk: entityKey("chatbot", asString(data.chatbotId)),
          ownerSk: `CHUNK#${documentId}#${paddedIndex}#${id}`,
          relatedPk: entityKey("document", documentId),
          relatedSk: `CHUNK#${paddedIndex}#${id}`,
        };
        await put(item, "attribute_not_exists(pk)");
        return publicItem(item);
      },
      async deleteMany({ where }: { where: Where }) {
        const items = await queryRelated(entityKey("document", asString(where.documentId)), "CHUNK#");
        await deleteItems(items);
        return { count: items.length };
      },
      async findMany({ where, include }: { where: Where; include?: Include }) {
        const idFilter = where.id as { in?: unknown[] } | undefined;
        const items = idFilter?.in
          ? (await Promise.all(idFilter.in.map((id) => get("chunk", asString(id))))).filter(
              (item): item is Item => Boolean(item),
            )
          : where.documentId
            ? await queryRelated(entityKey("document", asString(where.documentId)), "CHUNK#")
            : await queryOwner(entityKey("chatbot", asString(where.chatbotId)), "CHUNK#");
        const ownedItems = items.filter((item) => {
          if (where.userId && item.userId !== where.userId) return false;
          if (where.chatbotId && item.chatbotId !== where.chatbotId) return false;
          if (where.documentId && item.documentId !== where.documentId) return false;
          return true;
        });
        return Promise.all(
          ownedItems.map(async (item) => {
            const chunk = publicItem(item) as Record<string, unknown>;
            if (include?.document) {
              chunk.document = publicItem(await get("document", asString(item.documentId)));
            }
            return chunk;
          }),
        );
      },
    },
    conversation: {
      async create({ data }: { data: Data }) {
        const id = randomUUID();
        const createdAt = now();
        const item = {
          pk: entityKey("conversation", id),
          entity: "Conversation",
          id,
          userId: asOptionalString(data.userId),
          chatbotId: asString(data.chatbotId),
          title: asString(data.title),
          createdAt,
          ownerPk: entityKey("chatbot", asString(data.chatbotId)),
          ownerSk: `CONVERSATION#${createdAt}#${id}`,
          relatedPk: entityKey("user", asString(data.userId)),
          relatedSk: `CONVERSATION#${createdAt}#${id}`,
        };
        await put(item, "attribute_not_exists(pk)");
        return publicItem(item);
      },
      async findFirst({ where, include }: { where: Where; include?: Include }) {
        const item = await get("conversation", asString(where.id));
        if (!item) return null;
        if (where.userId && item.userId !== where.userId) return null;
        if (where.chatbotId && item.chatbotId !== where.chatbotId) return null;
        const conversation = publicItem(item) as Record<string, unknown>;
        if (include?.messages) {
          const messages = await queryOwner(entityKey("conversation", asString(item.id)), "MESSAGE#");
          conversation.messages = messages
            .filter((message) => !where.userId || message.userId === where.userId)
            .map(publicItem);
        }
        return conversation;
      },
    },
    message: {
      async create({ data }: { data: Data }) {
        const id = randomUUID();
        const createdAt = now();
        const item = {
          pk: entityKey("message", id),
          entity: "Message",
          id,
          userId: asOptionalString(data.userId),
          conversationId: asString(data.conversationId),
          role: asString(data.role),
          content: asString(data.content),
          sourcesJson: asOptionalString(data.sourcesJson),
          createdAt,
          ownerPk: entityKey("conversation", asString(data.conversationId)),
          ownerSk: `MESSAGE#${createdAt}#${id}`,
          relatedPk: entityKey("user", asString(data.userId)),
          relatedSk: `MESSAGE#${createdAt}#${id}`,
        };
        await put(item, "attribute_not_exists(pk)");
        return publicItem(item);
      },
      async findFirst({ where }: { where: Where }) {
        const item = await get("message", asString(where.id));
        if (!item) return null;
        if (where.userId && item.userId !== where.userId) return null;
        if (where.role && item.role !== where.role) return null;
        const conversationFilter = where.conversation as Where | undefined;
        if (conversationFilter) {
          const conversation = await get("conversation", asString(item.conversationId));
          if (!conversation) return null;
          if (conversationFilter.userId && conversation.userId !== conversationFilter.userId) return null;
          if (conversationFilter.chatbotId && conversation.chatbotId !== conversationFilter.chatbotId) {
            return null;
          }
        }
        return publicItem(item);
      },
    },
  };
}
