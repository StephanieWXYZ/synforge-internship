type ChatAnswerInput = {
  systemPrompt: string;
  context: string;
  question: string;
};

const baseUrl = process.env.LLM_BASE_URL ?? "https://api.openai.com/v1";

function getApiKey() {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error("LLM_API_KEY is required to call the LLM provider.");
  }
  return apiKey;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
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
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL ?? "gpt-4.1-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: [
            input.systemPrompt,
            "You are a domain-specific document assistant.",
            "Answer only with the uploaded document context provided.",
            "If the context is insufficient, say exactly: I don't have enough information in the uploaded documents to answer that.",
            "Do not invent facts. Keep answers practical and concise.",
          ].join("\n"),
        },
        {
          role: "user",
          content: `Document context:\n${input.context}\n\nQuestion:\n${input.question}`,
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
