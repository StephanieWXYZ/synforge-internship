export type ConversationListItem = {
  id: string;
  createdAt: Date;
  messages?: Array<{ createdAt: Date }>;
};

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
