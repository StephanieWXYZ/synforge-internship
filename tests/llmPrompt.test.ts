import { afterEach, describe, expect, it, vi } from "vitest";

import { generateChatAnswer, generateEmbeddings } from "@/lib/llm";
import { NO_ANSWER_FALLBACK } from "@/lib/rag";

describe("generateChatAnswer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("constructs a document-only prompt without calling a real model", async () => {
    vi.stubEnv("LLM_API_KEY", "test-key");
    vi.stubEnv("LLM_MODEL", "test-chat-model");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "The monthly rent amount is $2,000." } }],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generateChatAnswer({
        systemPrompt: "Only answer from uploaded lease documents.",
        context: "The monthly rent amount is $2,000.",
        question: "How much is the monthly rent?",
      }),
    ).resolves.toBe("The monthly rent amount is $2,000.");

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as {
      messages: Array<{ role: string; content: string }>;
    };

    expect(requestBody.messages[0]).toEqual({
      role: "system",
      content: expect.stringContaining("Answer only with the uploaded document context provided."),
    });
    expect(requestBody.messages[0].content).toContain(NO_ANSWER_FALLBACK);
    expect(requestBody.messages[1]).toEqual({
      role: "user",
      content:
        "Document context:\nThe monthly rent amount is $2,000.\n\nQuestion:\nHow much is the monthly rent?",
    });
  });

  it("requests multiple embeddings in one provider call and preserves input order", async () => {
    vi.stubEnv("LLM_API_KEY", "test-key");
    vi.stubEnv("EMBEDDING_MODEL", "test-embedding-model");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { index: 1, embedding: [0, 1] },
            { index: 0, embedding: [1, 0] },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateEmbeddings(["first", "second"])).resolves.toEqual([
      [1, 0],
      [0, 1],
    ]);

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as {
      input: string[];
    };
    expect(requestBody.input).toEqual(["first", "second"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
