import type { ChatListItem, ChatMessage, ChatUser, Conversation, ConversationMember, DeleteConversationScope, DraftConversation, MessageCursor } from '~/types/chat';

const MESSAGE_PAGE_SIZE = 20;
const LOAD_ALL_LIMIT = 0;

export const useChatData = () => {
  const api = useEnfyraApi();
  const { user } = useAuth();

  const chatItems = ref<ChatListItem[]>([]);
  const activeId = ref('');
  const threadMessages = ref<ChatMessage[]>([]);
  const conversationsLoading = ref(true);
  const messagesLoading = ref(false);
  const olderMessagesLoading = ref(false);
  const hasOlderMessages = ref(false);
  const olderCursor = ref<MessageCursor | null>(null);
  const creatingChat = ref(false);
  const lastActiveConversation = ref<Conversation | null>(null);
  const draftConversation = ref<DraftConversation | null>(null);
  let messageLoadRun = 0;
  const sameId = (left: unknown, right: unknown) => left != null && right != null && left == right;
  const idOf = (value: unknown) => value == null ? '' : `${value}`;

  const emptyConversation: Conversation = {
    id: '',
    kind: 'dm',
    title: 'No conversation',
    members: [],
    unreadCount: 0,
  };

  const mapUser = (value: any): ChatUser => ({
    id: idOf(value?.id),
    email: value?.email || '',
    displayName: value?.displayName || value?.email || 'Unknown user',
    avatarUrl: value?.avatarUrl || null,
    statusText: value?.statusText || null,
    lastSeenAt: value?.lastSeenAt || value?.updatedAt || null,
  });

  const mapMember = (membership: any): ConversationMember => ({
    id: idOf(membership?.id),
    role: membership?.role === 'owner' ? 'owner' : 'member',
    member: mapUser(membership?.member || {}),
    lastReadAt: membership?.lastReadAt || null,
  });

  const mapConversation = (conversation: any, members: ConversationMember[] = []): Conversation => {
    const conversationId = idOf(conversation?.id);
    const lastMessage = conversation?.lastMessage?.id
      ? mapMessage(conversation.lastMessage, conversationId)
      : null;
    return {
      id: conversationId,
      kind: conversation?.kind === 'group' ? 'group' : 'dm',
      title: conversation?.title || 'Untitled chat',
      description: conversation?.description || null,
      members,
      lastMessage,
      lastMessageText: lastMessage?.text || null,
      lastMessageAt: lastMessage?.createdAt || null,
      unreadCount: 0,
    };
  };

  const activeConversation = computed(() => {
    if (draftConversation.value && activeId.value === 'draft') {
      const draft: Conversation = {
        id: 'draft',
        kind: 'dm',
        title: draftConversation.value.target.displayName,
        members: [
          ...(user.value ? [{ id: 'draft-self', role: 'owner' as const, member: user.value }] : []),
          { id: 'draft-target', role: 'member' as const, member: draftConversation.value.target },
        ],
        unreadCount: 0,
      };
      return draft;
    }
    const active = chatItems.value.find((item) => sameId(item.conversation.id, activeId.value))?.conversation;
    if (active) return active;
    if (lastActiveConversation.value?.id === activeId.value) return lastActiveConversation.value;
    if (activeId.value) {
      return {
        ...emptyConversation,
        id: activeId.value,
        title: conversationsLoading.value ? 'Loading conversation' : 'Conversation unavailable',
      };
    }
    return emptyConversation;
  });

  const clearActiveConversation = () => {
    activeId.value = '';
    draftConversation.value = null;
    threadMessages.value = [];
    hasOlderMessages.value = false;
    olderCursor.value = null;
    messagesLoading.value = false;
    olderMessagesLoading.value = false;
    lastActiveConversation.value = null;
  };

  const fetchUnreadConversationIds = async () => {
    if (!user.value?.id) return new Set<string>();
    try {
      const response = await api.get('/chat_message_read', {
        query: {
          filter: JSON.stringify({
            member: { id: { _eq: user.value.id } },
            isRead: { _eq: false },
          }),
          fields: 'conversation',
          limit: LOAD_ALL_LIMIT,
        },
      });
      const rows = api.rowsOf<any>(response);
      const ids = rows
        .map((row) => idOf(row.conversation?.id || row.conversation))
        .filter(Boolean);
      return new Set(ids);
    } catch {
      return new Set<string>();
    }
  };

  const createMembership = (conversationId: string, memberId: string, role: 'owner' | 'member') => {
    return api.post('/chat_conversation_member', {
      role,
      joinedAt: new Date().toISOString(),
      conversation: { id: conversationId },
      member: { id: memberId },
    });
  };

  const mapMessage = (row: any, conversationId: string): ChatMessage => ({
    id: idOf(row.id),
    conversationId: idOf(conversationId),
    sender: mapUser(row.sender || {}),
    text: row.text,
    createdAt: row.createdAt,
    status: row.persistStatus === 'failed' ? 'failed' : 'persisted',
  });

  const setOlderCursor = (messages: ChatMessage[]) => {
    const oldest = messages[0];
    olderCursor.value = oldest ? { id: oldest.id, createdAt: oldest.createdAt } : null;
  };

  const fetchMessages = async (conversationId: string) => {
    const runId = ++messageLoadRun;
    if (!conversationId) {
      threadMessages.value = [];
      hasOlderMessages.value = false;
      olderCursor.value = null;
      return;
    }
    messagesLoading.value = true;
    threadMessages.value = [];
    hasOlderMessages.value = false;
    olderCursor.value = null;
    try {
      const response = await api.get('/chat_message', {
        query: {
          filter: JSON.stringify({ conversation: { id: { _eq: conversationId } } }),
          deep: JSON.stringify({ sender: {} }),
          sort: '-createdAt,-id',
          limit: MESSAGE_PAGE_SIZE,
          meta: 'filterCount',
        },
      });
      if (runId !== messageLoadRun) return;
      const rows = api.rowsOf<any>(response);
      hasOlderMessages.value = (api.filterCountOf(response) ?? rows.length) > rows.length;
      const messages = rows.map((row) => mapMessage(row, conversationId)).reverse();
      threadMessages.value = messages;
      setOlderCursor(messages);
    } finally {
      if (runId === messageLoadRun) messagesLoading.value = false;
    }
  };

  const loadOlderMessages = async () => {
    const conversationId = activeId.value;
    const cursor = olderCursor.value;
    if (!conversationId || !cursor || olderMessagesLoading.value || !hasOlderMessages.value) return;

    olderMessagesLoading.value = true;
    try {
      const response = await api.get('/chat_message', {
        query: {
          filter: JSON.stringify({
            conversation: { id: { _eq: conversationId } },
            _or: [
              { createdAt: { _lt: cursor.createdAt } },
              {
                createdAt: { _eq: cursor.createdAt },
                id: { _lt: cursor.id },
              },
            ],
          }),
          deep: JSON.stringify({ sender: {} }),
          sort: '-createdAt,-id',
          limit: MESSAGE_PAGE_SIZE,
          meta: 'filterCount',
        },
      });
      const rows = api.rowsOf<any>(response);
      const older = rows.map((row) => mapMessage(row, conversationId)).reverse();
      hasOlderMessages.value = (api.filterCountOf(response) ?? rows.length) > rows.length;
      threadMessages.value = [...older, ...threadMessages.value];
      setOlderCursor(threadMessages.value);
    } finally {
      olderMessagesLoading.value = false;
    }
  };

  const refreshConversations = async (options: { silent?: boolean } = {}) => {
    if (!user.value?.id) {
      chatItems.value = [];
      conversationsLoading.value = false;
      return;
    }

    if (!options.silent) {
      conversationsLoading.value = true;
    }
    try {
      const response = await api.get('/chat_conversation', {
        query: {
          fields: 'id,kind,title,description,updatedAt,lastMessage.id,lastMessage.text,lastMessage.createdAt,lastMessage.persistStatus,lastMessage.sender.id,lastMessage.sender.email,lastMessage.sender.displayName,lastMessage.sender.avatarUrl,lastMessage.sender.statusText',
          limit: LOAD_ALL_LIMIT,
        },
      });

      const conversations = api.rowsOf<any>(response);
      const unreadConversationIds = await fetchUnreadConversationIds();
      const items: ChatListItem[] = [];
      for (const conversation of conversations) {
        if (!conversation?.id) continue;
        const conversationId = idOf(conversation.id);
        const mappedConversation = mapConversation(conversation);
        const unreadCount = unreadConversationIds.has(conversationId) ? 1 : 0;
        mappedConversation.unreadCount = unreadCount;
        items.push({
          conversation: mappedConversation,
          membership: mapMember({ member: user.value }),
          members: [],
          unreadCount,
        });
      }

      const collapsed = new Map<string, ChatListItem>();
      for (const item of items) {
        const key = `conversation:${item.conversation.id}`;
        const existing = collapsed.get(key);
        if (existing && item.unreadCount) {
          existing.unreadCount = 1;
          existing.conversation.unreadCount = 1;
        }
        if (!existing || (item.conversation.lastMessageAt || '').localeCompare(existing.conversation.lastMessageAt || '') > 0) {
          const unreadCount = existing?.unreadCount || item.unreadCount ? 1 : 0;
          collapsed.set(key, {
            ...item,
            unreadCount,
            conversation: {
              ...item.conversation,
              unreadCount,
            },
          });
        }
      }

      chatItems.value = Array.from(collapsed.values()).sort((a, b) => (b.conversation.lastMessageAt || '').localeCompare(a.conversation.lastMessageAt || ''));
    } catch {
      chatItems.value = [];
    } finally {
      if (!options.silent) {
        conversationsLoading.value = false;
      }
    }
  };

  const openConversation = async (conversationId: string) => {
    const normalizedId = idOf(conversationId);
    await refreshConversations({ silent: true });
    activeId.value = normalizedId;
    draftConversation.value = null;
  };

  const startDirectMessage = async (target: ChatUser) => {
    if (!user.value?.id || !target.id) return;
    const existing = chatItems.value.find((item) =>
      item.conversation.kind === 'dm' &&
      item.members.some((member) => member.id === target.id),
    );
    if (existing) {
      activeId.value = idOf(existing.conversation.id);
      draftConversation.value = null;
      return;
    }
    draftConversation.value = { kind: 'dm', target };
    activeId.value = 'draft';
    threadMessages.value = [];
    hasOlderMessages.value = false;
    olderCursor.value = null;
  };

  const createDraftConversation = async () => {
    if (!user.value?.id || !draftConversation.value || creatingChat.value) return '';
    const target = draftConversation.value.target;
    creatingChat.value = true;
    try {
      const response = await api.post('/chat_conversation', {
        kind: 'dm',
        title: target.displayName,
        description: null,
        createdBy: { id: user.value.id },
      });
      const conversation = api.firstRowOf<any>(response);
      const conversationId = idOf(conversation?.id);
      if (!conversationId) return '';
      await Promise.all([
        createMembership(conversationId, user.value.id, 'owner'),
        createMembership(conversationId, target.id, 'member'),
      ]);
      draftConversation.value = null;
      activeId.value = conversationId;
      await refreshConversations({ silent: true });
      return conversationId;
    } finally {
      creatingChat.value = false;
    }
  };

  const createGroupChat = async (payload: { members: ChatUser[] }) => {
    if (!user.value?.id || creatingChat.value) return;
    const memberIds = Array.from(new Set(payload.members.map((member) => member.id).filter(Boolean)));
    if (memberIds.length < 2) return;
    const title = payload.members.map((member) => member.displayName || member.email).join(', ');

    creatingChat.value = true;
    try {
      const response = await api.post('/chat_conversation', {
        kind: 'group',
        title,
        description: null,
        createdBy: { id: user.value.id },
      });
      const conversation = api.firstRowOf<any>(response);
      const conversationId = idOf(conversation?.id);
      if (!conversationId) return;
      await Promise.all([
        createMembership(conversationId, user.value.id, 'owner'),
        ...memberIds.map((memberId) => createMembership(conversationId, memberId, 'member')),
      ]);
      await openConversation(conversationId);
    } finally {
      creatingChat.value = false;
    }
  };

  const touchConversationPreview = (conversationId: string, text: string, createdAt: string) => {
    const normalizedId = idOf(conversationId);
    const index = chatItems.value.findIndex((item) => sameId(item.conversation.id, normalizedId));
    if (index < 0) return;
    const item = chatItems.value[index];
    if (!item) return;
    const updated = {
      ...item,
      conversation: {
        ...item.conversation,
        lastMessageText: text,
        lastMessageAt: createdAt,
      },
    };
    chatItems.value = [
      updated,
      ...chatItems.value.slice(0, index),
      ...chatItems.value.slice(index + 1),
    ];
  };

  const setConversationUnread = (conversationId: string, unread: boolean) => {
    const normalizedId = idOf(conversationId);
    const index = chatItems.value.findIndex((item) => sameId(item.conversation.id, normalizedId));
    if (index < 0) return;
    const item = chatItems.value[index];
    if (!item) return;
    const unreadCount = unread ? 1 : 0;
    chatItems.value[index] = {
      ...item,
      unreadCount,
      conversation: {
        ...item.conversation,
        unreadCount,
      },
    };
  };

  const hasConversation = (conversationId: string) => {
    const normalizedId = idOf(conversationId);
    return chatItems.value.some((item) => sameId(item.conversation.id, normalizedId));
  };

  const sortThreadMessages = () => {
    threadMessages.value = [...threadMessages.value].sort((a, b) => {
      const byCreatedAt = (a.createdAt || '').localeCompare(b.createdAt || '');
      if (byCreatedAt !== 0) return byCreatedAt;
      return (a.id || '').localeCompare(b.id || '');
    });
  };

  const upsertMessage = (message: ChatMessage) => {
    if (!sameId(message.conversationId, activeId.value)) return;
    const index = threadMessages.value.findIndex((item) => item.id === message.id);
    if (index >= 0) {
      threadMessages.value[index] = { ...threadMessages.value[index], ...message };
      sortThreadMessages();
      return;
    }
    const pendingIndex = threadMessages.value.findIndex((item) =>
      item.status === 'sending' &&
      item.conversationId === message.conversationId &&
      item.sender.id === message.sender.id &&
      item.text === message.text,
    );
    if (pendingIndex >= 0) {
      threadMessages.value[pendingIndex] = message;
      sortThreadMessages();
      return;
    }
    threadMessages.value.push(message);
    sortThreadMessages();
  };

  const persistMessageFallback = async (text: string, optimistic: ChatMessage) => {
    try {
      const response = await api.post('/chat_message', {
        text,
        persistStatus: 'persisted',
        conversation: { id: activeId.value },
        sender: { id: user.value?.id },
      });
      const persisted = api.firstRowOf<any>(response);
      const persistedId = idOf(persisted?.id || optimistic.id);
      const persistedAt = persisted?.createdAt || optimistic.createdAt;
      await api.patch(`/chat_conversation/${activeId.value}`, {
        lastMessage: { id: persistedId },
        updatedAt: persistedAt,
      });
      touchConversationPreview(activeId.value, text, persistedAt);
      upsertMessage({ ...optimistic, id: persistedId, createdAt: persistedAt, status: 'persisted' });
      await refreshConversations();
    } catch {
      upsertMessage({ ...optimistic, status: 'failed' });
    }
  };

  const activeMembershipsFor = async (conversationId: string) => {
    const response = await api.get('/chat_conversation_member', {
      query: {
        filter: JSON.stringify({
          conversation: { id: { _eq: conversationId } },
        }),
        deep: JSON.stringify({ member: {} }),
        limit: LOAD_ALL_LIMIT,
      },
    });
    return api.rowsOf<any>(response);
  };

  const hideConversationLocally = (conversationId: string) => {
    const normalizedId = idOf(conversationId);
    chatItems.value = chatItems.value.filter((item) => !sameId(item.conversation.id, normalizedId));
    if (sameId(activeId.value, normalizedId)) {
      activeId.value = idOf(chatItems.value[0]?.conversation.id);
      if (!activeId.value) {
        threadMessages.value = [];
      }
    }
  };

  const deleteConversation = async (conversationId: string, scope: DeleteConversationScope) => {
    if (!user.value?.id || !conversationId) return;
    const item = chatItems.value.find((row) => sameId(row.conversation.id, conversationId));
    if (!item) return;

    const memberships = await activeMembershipsFor(conversationId);
    const targetMemberships = scope === 'everyone' && item.conversation.kind === 'dm'
      ? memberships
      : memberships.filter((membership) => (membership.member?.id || membership.member) === user.value?.id);

    await Promise.all(targetMemberships.map((membership) =>
      api.del(`/chat_conversation_member/${membership.id}`),
    ));

    hideConversationLocally(conversationId);

    const remaining = await activeMembershipsFor(conversationId);
    if (remaining.length === 0) {
      await api.del(`/chat_conversation/${conversationId}`).catch(() => null);
    }
  };

  watch(activeId, async (id) => {
    if (id === 'draft') {
      messagesLoading.value = false;
      return;
    }
    if (!id) {
      await fetchMessages(id);
      return;
    }
    await fetchMessages(id);
  }, { immediate: true });

  watch([chatItems, activeId], () => {
    const active = chatItems.value.find((item) => sameId(item.conversation.id, activeId.value))?.conversation;
    if (active) {
      lastActiveConversation.value = active;
    }
  }, { immediate: true });

  return {
    chatItems,
    activeId,
    draftConversation,
    activeConversation,
    threadMessages,
    conversationsLoading,
    messagesLoading,
    olderMessagesLoading,
    hasOlderMessages,
    creatingChat,
    refreshConversations,
    fetchMessages,
    loadOlderMessages,
    startDirectMessage,
    openConversation,
    clearActiveConversation,
    createDraftConversation,
    createGroupChat,
    deleteConversation,
    hideConversationLocally,
    hasConversation,
    touchConversationPreview,
    setConversationUnread,
    upsertMessage,
    persistMessageFallback,
  };
};
