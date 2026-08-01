import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

export type LlmRuntimeConfig = {
  apiKey: string;
  baseUrl: string;
  chatModel: string;
  embeddingModel: string;
};

let remoteConfig: Promise<LlmRuntimeConfig> | undefined;

export function getLlmRuntimeConfig(): Promise<LlmRuntimeConfig> {
  const secretName = process.env.RUNTIME_SECRET_NAME?.trim();
  if (!secretName) {
    return Promise.resolve(normalizeConfig(process.env));
  }

  remoteConfig ??= loadSecret(secretName);
  return remoteConfig;
}

async function loadSecret(secretName: string): Promise<LlmRuntimeConfig> {
  const client = new SecretsManagerClient({});
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretName }),
  );
  if (!response.SecretString) {
    throw new Error(`Runtime secret ${secretName} does not contain a SecretString.`);
  }

  const parsed = JSON.parse(response.SecretString) as Record<string, string | undefined>;
  return normalizeConfig(parsed);
}

function normalizeConfig(values: Record<string, string | undefined>): LlmRuntimeConfig {
  const apiKey = values.LLM_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("LLM_API_KEY is required to call the LLM provider.");
  }

  return {
    apiKey,
    baseUrl: values.LLM_BASE_URL?.trim() || "https://api.openai.com/v1",
    chatModel: values.LLM_MODEL?.trim() || "gpt-4.1-mini",
    embeddingModel: values.EMBEDDING_MODEL?.trim() || "text-embedding-3-small",
  };
}
