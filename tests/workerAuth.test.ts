import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: class { send = mocks.send; },
  GetSecretValueCommand: class {
    constructor(public input: unknown) {}
  },
}));

import { signWorkerRequest, verifyWorkerRequest } from "@/lib/workerAuth";

describe("worker request authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WORKER_SECRET_NAME = "worker-secret";
    mocks.send.mockResolvedValue({ SecretString: "test-secret-value" });
  });

  it("accepts an untampered recent signature", async () => {
    const timestamp = String(Date.now());
    const body = '{"documentId":"doc-1"}';
    const signed = await signWorkerRequest(body, timestamp);
    await expect(
      verifyWorkerRequest(body, timestamp, signed.signature, Number(timestamp)),
    ).resolves.toBe(true);
    await expect(
      verifyWorkerRequest(`${body}x`, timestamp, signed.signature, Number(timestamp)),
    ).resolves.toBe(false);
  });

  it("rejects expired signatures before processing", async () => {
    const timestamp = String(Date.now() - 10 * 60 * 1000);
    await expect(verifyWorkerRequest("{}", timestamp, "0".repeat(64))).resolves.toBe(false);
  });
});
