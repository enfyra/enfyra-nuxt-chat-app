export interface ChatUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  statusText?: string;
  lastSeenAt?: string;
}

export interface ConversationMember {
  id: string;
  role: 'owner' | 'member';
  member: ChatUser;
  lastReadAt?: string;
}

export interface Conversation {
  id: string;
  kind: 'dm' | 'group';
  title: string;
  description?: string;
  members: ConversationMember[];
  lastMessage?: ChatMessage | null;
  lastMessageText?: string;
  lastMessageAt?: string;
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  sender: ChatUser;
  text: string;
  createdAt: string;
  status: 'sending' | 'delivered' | 'persisted' | 'failed';
}

export interface TypingUser {
  conversationId: string;
  userId: string;
  displayName: string;
}

export interface MessageCursor {
  id: string;
  createdAt: string;
}

export interface DraftConversation {
  kind: 'dm';
  target: ChatUser;
}

export interface ChatListItem {
  conversation: Conversation;
  membership: ConversationMember;
  members: ChatUser[];
  unreadCount: number;
}

export type DeleteConversationScope = 'self' | 'everyone';

export interface NewConversationPayload {
  kind: 'dm' | 'group';
  memberIds: string[];
  title?: string;
  text?: string;
  messageId?: string;
}
