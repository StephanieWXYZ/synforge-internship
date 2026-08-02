import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { loadEnvConfig } from "@next/env";

import { parseEmbedding } from "../src/lib/similarity";
import {
  getEmbeddingVersion,
  getVectorStore,
  type VectorRecord,
} from "../src/lib/vectorStore";

type ChunkItem = {
  id?: string;
  userId?: string;
  chatbotId?: string;
  documentId?: string;
  embedding?: string;
};

const WRITE_BATCH_SIZE = 100;

async function main() {
  loadEnvConfig(process.cwd());
  const write = process.argv.includes("--write");
  const verify = process.argv.includes("--verify");
  const documentId = readArgument("--document-id");
  const tableName = process.env.DYNAMODB_TABLE_NAME?.trim();
  if (!tableName) throw new Error("DYNAMODB_TABLE_NAME is required.");
  if (process.env.VECTOR_STORE !== "s3-vectors") {
    throw new Error("Set VECTOR_STORE=s3-vectors before running the vector backfill.");
  }

  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  const records: VectorRecord[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;
  do {
    const response = await client.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: lastEvaluatedKey,
        FilterExpression: "#entity = :chunk",
        ExpressionAttributeNames: { "#entity": "entity" },
        ExpressionAttributeValues: { ":chunk": "DocumentChunk" },
        ProjectionExpression: "id, userId, chatbotId, documentId, embedding",
      }),
    );
    for (const item of (response.Items ?? []) as ChunkItem[]) {
      if (documentId && item.documentId !== documentId) continue;
      if (!item.id || !item.userId || !item.chatbotId || !item.documentId || !item.embedding) {
        throw new Error(`Chunk ${item.id || "<unknown>"} is missing required vector fields.`);
      }
      records.push({
        chunkId: item.id,
        userId: item.userId,
        chatbotId: item.chatbotId,
        documentId: item.documentId,
        embedding: parseEmbedding(item.embedding),
        embeddingVersion: getEmbeddingVersion(),
      });
    }
    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  console.log(`Found ${records.length} chunk vectors${documentId ? ` for ${documentId}` : ""}.`);
  if (!write && !verify) {
    console.log("Dry run only. Re-run with --write to insert vectors.");
    return;
  }

  if (write) {
    for (let offset = 0; offset < records.length; offset += WRITE_BATCH_SIZE) {
      await getVectorStore().upsert(records.slice(offset, offset + WRITE_BATCH_SIZE));
      console.log(`Indexed ${Math.min(offset + WRITE_BATCH_SIZE, records.length)}/${records.length}.`);
    }
  }

  if (verify) {
    const sample = records[0];
    if (!sample) {
      console.log("No vectors to verify.");
      return;
    }
    const matches = await getVectorStore().query({
      userId: sample.userId,
      chatbotId: sample.chatbotId,
      limit: 5,
      getQueryVector: async () => sample.embedding,
    });
    if (!matches.some((match) => match.chunkId === sample.chunkId)) {
      throw new Error(`Vector verification did not retrieve sample chunk ${sample.chunkId}.`);
    }
    console.log(`Verified sample chunk ${sample.chunkId} through tenant-filtered vector search.`);
  }
}

function readArgument(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
