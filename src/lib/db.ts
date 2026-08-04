import { PrismaClient } from "@prisma/client";

import { createDynamoDb } from "@/lib/dynamodbDb";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  dynamodb?: ReturnType<typeof createDynamoDb>;
};

const dynamoTableName = process.env.DYNAMODB_TABLE_NAME;
const database = dynamoTableName
  ? (globalForPrisma.dynamodb ?? createDynamoDb(dynamoTableName))
  : (globalForPrisma.prisma ??
    new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    }));

export const db = database as PrismaClient;

if (process.env.NODE_ENV !== "production") {
  if (dynamoTableName) {
    globalForPrisma.dynamodb = database as ReturnType<typeof createDynamoDb>;
  } else {
    globalForPrisma.prisma = database as PrismaClient;
  }
}
