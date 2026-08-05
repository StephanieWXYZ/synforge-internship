import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { createDocumentStoragePath, removeStoredDocument } from "@/lib/documentStorage";

describe("document storage", () => {
  beforeEach(() => {
    delete process.env.UPLOAD_BUCKET_NAME;
  });

  it("removes local uploaded files from the uploads directory", async () => {
    const filePath = createDocumentStoragePath("user-1", "chatbot-1", "lease.txt");
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, "lease content");

    await expect(removeStoredDocument(filePath)).resolves.toBeUndefined();
    await expect(readFile(filePath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("treats an already-missing local upload as recoverable", async () => {
    const filePath = createDocumentStoragePath("user-1", "chatbot-1", "missing.txt");

    await expect(removeStoredDocument(filePath)).resolves.toBeUndefined();
  });

  it("rejects local file paths outside the uploads directory", async () => {
    await expect(removeStoredDocument(path.join(process.cwd(), "package.json"))).rejects.toThrow(
      "outside the uploads directory",
    );
  });
});
