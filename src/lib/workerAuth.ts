import { createHmac, timingSafeEqual } from "node:crypto";

import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000;

let workerSecret: Promise<string> | undefined;

async function getWorkerSecret() {
  const secretName = process.env.WORKER_SECRET_NAME?.trim();
  if (!secretName) {
    throw new Error("WORKER_SECRET_NAME is required for document worker authentication.");
  }

  workerSecret ??= new SecretsManagerClient({})
    .send(new GetSecretValueCommand({ SecretId: secretName }))
    .then((response) => {
      if (!response.SecretString) {
        throw new Error(`Worker secret ${secretName} does not contain a SecretString.`);
      }
      return response.SecretString;
    });
  return workerSecret;
}

function signaturePayload(body: string, timestamp: string) {
  return `${timestamp}.${body}`;
}

export async function signWorkerRequest(body: string, timestamp = String(Date.now())) {
  const secret = await getWorkerSecret();
  return {
    timestamp,
    signature: createHmac("sha256", secret)
      .update(signaturePayload(body, timestamp))
      .digest("hex"),
  };
}

export async function verifyWorkerRequest(
  body: string,
  timestamp: string | null,
  signature: string | null,
  now = Date.now(),
) {
  if (!timestamp || !signature || !/^\d+$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature)) {
    return false;
  }
  const requestTime = Number(timestamp);
  if (!Number.isSafeInteger(requestTime) || Math.abs(now - requestTime) > MAX_SIGNATURE_AGE_MS) {
    return false;
  }

  const expected = await signWorkerRequest(body, timestamp);
  return timingSafeEqual(Buffer.from(expected.signature, "hex"), Buffer.from(signature, "hex"));
}
