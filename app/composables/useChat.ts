import type { ChatMessage } from '~/types/chat';

export const useChat = () => {
  const route = useRoute();
  const router = useRouter();
  const { user, fetchUser } = useAuth();
  const data = useChatData();
  const presenceUserIds = () => {
    const ids = new Set<string>();
    for (const item of data.chatItems.value) {
      for (const member of item.members) {
        if (member.id && member.id !== user.value?.id) ids.add(member.id);
      }
    }
    for (const member of data.activeConversation.value.members) {
      const id = member.member.id;
      if (id && id !== user.value?.id) ids.add(id);
    }
    return Array.from(ids);
  };
  const socket = useChatSocket({
    activeId: data.activeId,
    getPresenceUserIds: presenceUserIds,
    upsertMessage: data.upsertMessage,
    touchConversationPreview: data.touchConversationPreview,
    hasConversation: data.hasConversation,
    refreshConversations: data.refreshConversations,
    removeConversation: data.hideConversationLocally,
    setConversationUnread: data.setConversationUnread,
  });

  const sameId = (left: unknown, right: unknown) => left != null && right != null && left == right;
  const idOf = (value: unknown) => value == null ? '' : `${value}`;

  const routeConversationId = () => {
    const value = route.params.conversationId;
    return Array.isArray(value) ? idOf(value[0]) : idOf(value);
  };

  const syncConversationUrl = (conversationId: string) => {
    if (!import.meta.client) return;
    if (conversationId === 'draft') {
      if (route.path !== '/chat/new') {
        void router.replace({ path: '/chat/new', query: route.query });
      }
      return;
    }
    const current = routeConversationId();
    if (sameId(current, conversationId)) return;
    void router.replace({
      path: conversationId ? `/chat/${conversationId}` : '/chat',
      query: route.query,
    });
  };

  const selectConversation = (conversationId: string) => {
    const normalizedId = idOf(conversationId);
    data.activeId.value = normalizedId;
    data.draftConversation.value = null;
    data.setConversationUnread(normalizedId, false);
    socket.emitRead(normalizedId);
    syncConversationUrl(normalizedId);
  };

  const sendMessage = async (text: string) => {
    if (!data.activeId.value || !user.value) return;
    const pendingId = `pending-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const createdAt = new Date().toISOString();
    if (data.activeId.value === 'draft') {
      const target = data.draftConversation.value?.target;
      if (!target?.id) return;
      const conversationId = idOf(await socket.emitNewConversation({
        kind: 'dm',
        memberIds: [target.id],
        text,
        messageId: pendingId,
      }));
      if (!conversationId) return;
      data.activeId.value = conversationId;
      data.draftConversation.value = null;
      syncConversationUrl(conversationId);
      const optimistic: ChatMessage = {
        id: pendingId,
        conversationId,
        sender: user.value,
        text,
        createdAt,
        status: 'delivered',
      };
      data.upsertMessage(optimistic);
      data.touchConversationPreview(conversationId, text, createdAt);
      data.setConversationUnread(conversationId, false);
      socket.emitRead(conversationId);
      return;
    }
    const optimistic: ChatMessage = {
      id: pendingId,
      conversationId: data.activeId.value,
      sender: user.value,
      text,
      createdAt,
      status: 'sending',
    };
    data.upsertMessage(optimistic);

    if (socket.emitMessage(text, pendingId)) return;
    await data.persistMessageFallback(text, optimistic);
  };

  const createGroupChat = async (payload: { members: Array<{ id: string; displayName?: string; email?: string }> }) => {
    if (!user.value?.id || data.creatingChat.value) return;
    const memberIds = Array.from(new Set(payload.members.map((member) => member.id).filter(Boolean)));
    if (memberIds.length < 2) return;
    data.creatingChat.value = true;
    try {
      const conversationId = idOf(await socket.emitNewConversation({
        kind: 'group',
        memberIds,
        title: payload.members.map((member) => member.displayName || member.email).filter(Boolean).join(', '),
      }));
      if (!conversationId) return;
      await data.openConversation(conversationId);
      syncConversationUrl(conversationId);
    } finally {
      data.creatingChat.value = false;
    }
  };

  const deleteConversation = async (conversationId: string, scope: 'self' | 'everyone') => {
    const deleted = await socket.emitDeleteConversation(conversationId, scope);
    if (deleted) {
      data.hideConversationLocally(conversationId);
      return;
    }
    await data.deleteConversation(conversationId, scope);
  };

  const start = async () => {
    if (!user.value?.id) {
      await fetchUser();
    }
    if (!user.value?.id) {
      await navigateTo('/login');
      return;
    }

    const requestedConversationId = routeConversationId();
    if (requestedConversationId && requestedConversationId !== 'new') {
      data.activeId.value = idOf(requestedConversationId);
    }
    await data.refreshConversations();
    const requestedItem = data.chatItems.value.find((item) => sameId(item.conversation.id, data.activeId.value));
    if (requestedItem) {
      data.activeId.value = idOf(requestedItem.conversation.id);
      data.setConversationUnread(requestedItem.conversation.id, false);
    }
    syncConversationUrl(data.activeId.value);
    socket.connect();
    socket.joinConversationRooms();
    if (data.activeId.value) {
      socket.emitRead(data.activeId.value);
    }
  };

  const stop = () => {
    socket.disconnect();
  };

  watch([data.chatItems, data.conversationsLoading], ([items, loading]) => {
    if (loading) {
      socket.joinConversationRooms();
      return;
    }
    if (!data.activeId.value && items[0]) {
      socket.joinConversationRooms();
      return;
    }
    if (data.activeId.value === 'draft') {
      socket.joinConversationRooms();
      return;
    }
    if (data.activeId.value && !items.some((item) => sameId(item.conversation.id, data.activeId.value))) {
      data.clearActiveConversation();
    }
    socket.joinConversationRooms();
  }, { immediate: true });

  watch(data.activeId, (id) => {
    syncConversationUrl(id);
    if (id && id !== 'draft') {
      data.setConversationUnread(id, false);
      socket.emitRead(id);
    }
  });

  watch(() => routeConversationId(), (conversationId) => {
    if (conversationId === 'new') return;
    if (!conversationId) {
      data.clearActiveConversation();
      return;
    }
    if (sameId(conversationId, data.activeId.value)) return;
    const existing = data.chatItems.value.find((item) => sameId(item.conversation.id, conversationId));
    data.activeId.value = idOf(existing?.conversation.id || conversationId);
    data.draftConversation.value = null;
    data.setConversationUnread(data.activeId.value, false);
    socket.emitRead(data.activeId.value);
  });

  return {
    user,
    socketState: socket.socketState,
    reconnectAttempt: socket.reconnectAttempt,
    reconnectLimit: socket.reconnectLimit,
    reconnectCountdown: socket.reconnectCountdown,
    showReconnectBanner: socket.showReconnectBanner,
    retryRealtime: socket.reloadForRetry,
    typingUsers: socket.typingUsers,
    onlineUserIds: socket.onlineUserIds,
    chatItems: data.chatItems,
    activeId: data.activeId,
    draftConversation: data.draftConversation,
    activeConversation: data.activeConversation,
    threadMessages: data.threadMessages,
    conversationsLoading: data.conversationsLoading,
    messagesLoading: data.messagesLoading,
    olderMessagesLoading: data.olderMessagesLoading,
    hasOlderMessages: data.hasOlderMessages,
    creatingChat: data.creatingChat,
    start,
    stop,
    selectConversation,
    sendMessage,
    loadOlderMessages: data.loadOlderMessages,
    startDirectMessage: data.startDirectMessage,
    createDraftConversation: data.createDraftConversation,
    createGroupChat,
    deleteConversation,
    setTyping: socket.emitTyping,
  };
};
