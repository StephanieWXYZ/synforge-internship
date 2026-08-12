export type ConversationListItem = {
  id: string;
  createdAt: Date;
  messages?: Array<{ createdAt: Date }>;
};

export const CONVERSATION_TITLE_MAX_LENGTH = 60;

export function createConversationTitle(firstUserMessage: string) {
  const normalizedMessage = firstUserMessage.trim().replace(/\s+/g, " ");

  if (normalizedMessage.length <= CONVERSATION_TITLE_MAX_LENGTH) {
    return normalizedMessage;
  }

  return normalizedMessage.slice(0, CONVERSATION_TITLE_MAX_LENGTH).trimEnd();
}

export function getConversationActivityAt(conversation: ConversationListItem) {
  return conversation.messages?.[0]?.createdAt ?? conversation.createdAt;
}

export function sortConversationsByRecentActivity<TConversation extends ConversationListItem>(
  conversations: TConversation[],
) {
  return [...conversations].sort(
    (a, b) =>
      getConversationActivityAt(b).getTime() - getConversationActivityAt(a).getTime(),
  );
}
