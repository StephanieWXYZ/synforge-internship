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
  const [embedding] = await generateEmbeddings([text]);
  return embedding;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const config = await getLlmRuntimeConfig();
  const response = await fetch(`${config.baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.embeddingModel,
      input: texts,
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding request failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    data?: Array<{ index?: number; embedding?: number[] }>;
  };

  const embeddings = new Array<number[] | undefined>(texts.length);
  for (const [position, item] of (data.data ?? []).entries()) {
    const index = item.index ?? position;
    if (index >= 0 && index < embeddings.length && item.embedding) {
      embeddings[index] = item.embedding;
    }
  }

  if (embeddings.some((embedding) => !embedding)) {
    throw new Error("Embedding response did not include every requested embedding.");
  }

  return embeddings as number[][];
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
