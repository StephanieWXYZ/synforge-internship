import { getLlmRuntimeConfig } from "@/lib/runtimeConfig";
import {
  buildDocumentOnlySystemPrompt,
  buildDocumentQuestionPrompt,
} from "@/lib/rag";

type ChatAnswerInput = {
  systemPrompt: string;
  context: string;
  question: string;
};

export async function generateEmbedding(text: string): Promise<number[]> {
  const config = await getLlmRuntimeConfig();
  const response = await fetch(`${config.baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.embeddingModel,
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding request failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };
  const embedding = data.data?.[0]?.embedding;
  if (!embedding) {
    throw new Error("Embedding response did not include an embedding.");
  }
  return embedding;
}

export async function generateChatAnswer(input: ChatAnswerInput): Promise<string> {
  const config = await getLlmRuntimeConfig();
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.chatModel,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: buildDocumentOnlySystemPrompt(input.systemPrompt),
        },
        {
          role: "user",
          content: buildDocumentQuestionPrompt(input.context, input.question),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Chat request failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}
