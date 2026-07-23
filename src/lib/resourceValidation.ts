import { db } from "@/lib/db";

export function findConversationForChatbot(
  userId: string,
  chatbotId: string,
  conversationId: string,
) {
  return db.conversation.findFirst({
    where: { id: conversationId, chatbotId, userId },
  });
}

export function findDocumentForChatbot(userId: string, chatbotId: string, documentId: string) {
  return db.document.findFirst({
    where: { id: documentId, chatbotId, userId },
  });
}
