import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const uploadRoot = path.join(process.cwd(), "uploads");
const uploadBucketName = process.env.UPLOAD_BUCKET_NAME?.trim();

let s3Client: S3Client | undefined;

function getS3Client() {
  s3Client ??= new S3Client({});
  return s3Client;
}

export function createDocumentStoragePath(
  userId: string,
  chatbotId: string,
  originalFileName: string,
) {
  const safeName = originalFileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storedName = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;

  if (uploadBucketName) {
    return `users/${userId}/chatbots/${chatbotId}/documents/${storedName}`;
  }

  return path.join(uploadRoot, storedName);
}

export async function storeDocument(filePath: string, buffer: Buffer) {
  if (uploadBucketName) {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: uploadBucketName,
        Key: filePath,
        Body: buffer,
      }),
    );
    return;
  }

  await mkdir(uploadRoot, { recursive: true });
  await writeFile(filePath, buffer);
}

export async function readStoredDocument(filePath: string) {
  if (uploadBucketName) {
    const response = await getS3Client().send(
      new GetObjectCommand({ Bucket: uploadBucketName, Key: filePath }),
    );

    if (!response.Body) {
      throw new Error("The uploaded document is empty or unavailable.");
    }

    return Buffer.from(await response.Body.transformToByteArray());
  }

  return readFile(filePath);
}

export async function removeStoredDocument(filePath: string) {
  if (uploadBucketName) {
    await getS3Client().send(
      new DeleteObjectCommand({ Bucket: uploadBucketName, Key: filePath }),
    );
    return;
  }

  try {
    await unlink(filePath);
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
      throw error;
    }
  }
}
