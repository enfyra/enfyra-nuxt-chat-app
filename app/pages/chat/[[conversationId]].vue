<script setup lang="ts">
import { LogOut, Menu, MessageSquareText, ShieldCheck, Trash2, X } from 'lucide-vue-next';
import type { DeleteConversationScope } from '~/types/chat';

definePageMeta({
  key: 'chat',
});

const {
  user,
  socketState,
  reconnectAttempt,
  reconnectLimit,
  reconnectCountdown,
  showReconnectBanner,
  retryRealtime,
  typingUsers,
  onlineUserIds,
  chatItems,
  activeId,
  activeConversation,
  threadMessages,
  conversationsLoading,
  messagesLoading,
  olderMessagesLoading,
  hasOlderMessages,
  creatingChat,
  start,
  stop,
  selectConversation,
  sendMessage,
  loadOlderMessages,
  startDirectMessage,
  createGroupChat,
  deleteConversation,
  setTyping,
} = useChat();
const { logout } = useAuth();
const { state: confirmState, confirm, setLoading } = useGlobalConfirm();
const detailsOpen = ref(false);
const conversationsOpen = ref(false);
const conversationCreatorOpen = ref(false);
const listLoading = computed(() => conversationsLoading.value && chatItems.value.length === 0);
const threadLoading = computed(() => messagesLoading.value || (conversationsLoading.value && activeId.value !== 'draft'));
const realtimeConnected = computed(() => socketState.value === 'connected');
const disconnectTitle = computed(() => {
  if (socketState.value === 'failed') return `Realtime connection failed after ${reconnectLimit} retries.`;
  const retryText = reconnectCountdown.value ? ` Retrying in ${reconnectCountdown.value}s.` : ' Retrying now.';
  const attemptText = reconnectAttempt.value ? ` Attempt ${reconnectAttempt.value}/${reconnectLimit}.` : '';
  return `Realtime connection lost.${retryText}${attemptText}`;
});

const requestDeleteConversation = async (scope: DeleteConversationScope) => {
  if (!activeConversation.value.id) return;
  const isGroup = activeConversation.value.kind === 'group';
  const otherMember = activeConversation.value.members.find((member) => member.member.id !== user.value?.id)?.member;
  const result = await confirm({
    title: isGroup ? 'Leave group chat?' : 'Delete this chat?',
    message: isGroup
      ? 'This removes you from the group. The group remains available for other members.'
      : 'This removes the conversation from your chat list only.',
    details: isGroup ? 'When the last member leaves, the group is cleaned up.' : undefined,
    optionLabel: isGroup ? undefined : `Also delete for ${otherMember?.displayName || 'the other person'}`,
    confirmText: isGroup ? 'Leave group' : 'Delete',
    cancelText: 'Keep chat',
    destructive: true,
  });
  if (!result.confirmed) return;

  setLoading(true);
  try {
    await deleteConversation(activeConversation.value.id, result.optionChecked && !isGroup ? 'everyone' : scope);
    detailsOpen.value = false;
  } finally {
    setLoading(false);
  }
};

const requestLogout = async () => {
  const result = await confirm({
    title: 'Sign out?',
    message: 'This will end the current chat session on this browser.',
    confirmText: 'Sign out',
    cancelText: 'Stay',
  });
  if (result.confirmed) await logout();
};

const selectConversationAndClose = (conversationId: string) => {
  selectConversation(conversationId);
  conversationsOpen.value = false;
};

onMounted(async () => {
  await start();
});

onBeforeUnmount(() => {
  stop();
});
</script>

<template>
  <main class="page-shell chat-page">
    <div class="app-grid-bg" />
    <header class="app-header">
      <div class="chat-header app-shell-container">
        <NuxtLink class="brand" to="/chat">
          <span class="brand-mark"><MessageSquareText :size="19" /></span>
          <span>Enfyra Demo Chat</span>
        </NuxtLink>
        <div class="header-actions">
          <UButton class="mobile-conversations-trigger" color="neutral" variant="outline" square aria-label="Open conversations" @click="conversationsOpen = true">
            <Menu :size="18" />
          </UButton>
          <UBadge class="connection-pill" color="neutral" variant="soft">
            <span class="status-dot" />
            Realtime · {{ socketState }}<template v-if="socketState === 'connecting' && reconnectAttempt"> · retry {{ reconnectAttempt }}/{{ reconnectLimit }}</template>
          </UBadge>
          <UButton to="/how-it-works" color="neutral" variant="outline" class="docs-link">
            <ShieldCheck :size="17" />
            How it works
          </UButton>
          <ThemeToggle />
          <UButton color="neutral" variant="outline" square aria-label="Logout" @click="requestLogout">
            <LogOut :size="18" />
          </UButton>
        </div>
      </div>
    </header>

    <Transition name="banner-slide">
      <div v-if="showReconnectBanner" class="disconnect-banner" role="status" aria-live="polite">
        <div class="disconnect-copy">
          <span class="disconnect-pulse" />
          <p>{{ disconnectTitle }} Chat is disabled until the socket reconnects.</p>
        </div>
        <button class="disconnect-retry" type="button" @click="retryRealtime">Retry now</button>
      </div>
    </Transition>

    <section class="chat-shell app-shell-container">
      <div class="desktop-conversation-list">
        <ConversationList
          :items="chatItems"
          :active-id="activeId"
          :loading="listLoading"
          :current-user-id="user?.id"
          :creating-chat="creatingChat"
          :online-user-ids="onlineUserIds"
          @select="selectConversation"
          @start-dm="startDirectMessage"
          @create-group="createGroupChat"
        />
      </div>
      <MessageThread
        :conversation="activeConversation"
        :messages="threadMessages"
        :own-user-id="user?.id"
        :loading="threadLoading"
        :loading-older="olderMessagesLoading"
        :has-older="hasOlderMessages"
        :composer-disabled="!realtimeConnected"
        :typing-users="typingUsers"
        @send="sendMessage"
        @typing="setTyping"
        @load-older="loadOlderMessages"
        @open-details="detailsOpen = true"
      />
    </section>

    <UDrawer
      v-model:open="conversationsOpen"
      direction="left"
      :handle="false"
      handle-only
      :dismissible="!conversationCreatorOpen"
      :ui="{ content: 'w-[min(22rem,92vw)] bg-[var(--card)] border-r border-[var(--border)]' }"
    >
      <template #content>
        <ConversationList
          class="mobile-conversation-drawer"
          :items="chatItems"
          :active-id="activeId"
          :loading="listLoading"
          :current-user-id="user?.id"
          :creating-chat="creatingChat"
          :online-user-ids="onlineUserIds"
          @select="selectConversationAndClose"
          @start-dm="startDirectMessage"
          @create-group="createGroupChat"
          @modal-open-change="conversationCreatorOpen = $event"
        />
      </template>
    </UDrawer>

    <UDrawer
      v-model:open="detailsOpen"
      direction="right"
      :handle="false"
      handle-only
      :modal="!confirmState.open"
      :dismissible="!confirmState.open"
      :ui="{ content: 'w-[min(24rem,100vw)] bg-[var(--card)] border-l border-[var(--border)]' }"
    >
      <template #content>
        <aside class="details-drawer" aria-label="Conversation data">
          <header class="drawer-header">
            <div>
              <p class="eyebrow">Conversation data</p>
              <h2>{{ activeConversation.title }}</h2>
              <span>{{ activeConversation.members.length }} members</span>
            </div>
            <UButton color="neutral" variant="outline" square aria-label="Close details" @click="detailsOpen = false">
              <X :size="18" />
            </UButton>
          </header>
          <MemberPanel :conversation="activeConversation" :current-user-id="user?.id" :online-user-ids="onlineUserIds" />
          <UButton
            v-if="activeConversation.id"
            class="drawer-delete"
            color="error"
            variant="soft"
            block
            @click="requestDeleteConversation('self')"
          >
            <Trash2 :size="16" />
            {{ activeConversation.kind === 'group' ? 'Leave group' : 'Delete conversation' }}
          </UButton>
        </aside>
      </template>
    </UDrawer>

  </main>
</template>
