import { describe, expect, it } from "vitest";

import {
  getConversationActivityAt,
  sortConversationsByRecentActivity,
} from "@/lib/conversations";

describe("conversation list helpers", () => {
  it("uses the latest message date as the conversation activity date", () => {
    const latestMessage = new Date("2026-02-05T12:00:00Z");
    const conversation = {
      id: "conversation-a",
      createdAt: new Date("2026-02-01T12:00:00Z"),
      messages: [{ createdAt: latestMessage }],
    };

    expect(getConversationActivityAt(conversation)).toBe(latestMessage);
  });

  it("falls back to the conversation creation date when there are no messages", () => {
    const createdAt = new Date("2026-02-01T12:00:00Z");

    expect(getConversationActivityAt({ id: "conversation-a", createdAt, messages: [] })).toBe(
      createdAt,
    );
  });

  it("sorts conversations by most recent activity", () => {
    const conversations = [
      {
        id: "older-message",
        createdAt: new Date("2026-02-01T12:00:00Z"),
        messages: [{ createdAt: new Date("2026-02-03T12:00:00Z") }],
      },
      {
        id: "newer-message",
        createdAt: new Date("2026-02-01T12:00:00Z"),
        messages: [{ createdAt: new Date("2026-02-05T12:00:00Z") }],
      },
      {
        id: "no-messages",
        createdAt: new Date("2026-02-04T12:00:00Z"),
        messages: [],
      },
    ];

    expect(sortConversationsByRecentActivity(conversations).map((conversation) => conversation.id))
      .toEqual(["newer-message", "no-messages", "older-message"]);
  });
});
