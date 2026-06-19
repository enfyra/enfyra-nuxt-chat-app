<script setup lang="ts">
import { Info, MessageCircle } from 'lucide-vue-next';
import type { ChatMessage, Conversation, TypingUser } from '~/types/chat';

const props = defineProps<{
  conversation: Conversation;
  messages: ChatMessage[];
  ownUserId?: string;
  loading?: boolean;
  loadingOlder?: boolean;
  hasOlder?: boolean;
  composerDisabled?: boolean;
  typingUsers?: TypingUser[];
}>();

const emit = defineEmits<{
  send: [text: string];
  typing: [isTyping: boolean];
  loadOlder: [];
  openDetails: [];
}>();

const messagesEl = ref<HTMLElement | null>(null);
const preservingOlderScroll = ref(false);
const pendingNewMessage = ref(false);
let olderScrollHeight = 0;
let olderScrollTop = 0;

const groupedMessages = computed(() => {
  const groups: Array<{ key: string; senderId: string; senderName: string; own: boolean; messages: ChatMessage[] }> = [];
  for (const message of props.messages) {
    const senderId = message.sender.id;
    const own = senderId === props.ownUserId;
    const previous = groups.at(-1);
    if (previous && previous.senderId === senderId) {
      previous.messages.push(message);
      continue;
    }
    groups.push({
      key: `${senderId}-${message.id}`,
      senderId,
      senderName: message.sender.displayName || message.sender.email || 'Someone',
      own,
      messages: [message],
    });
  }
  return groups;
});

const bubblePosition = (index: number, total: number) => {
  if (total === 1) return 'single';
  if (index === 0) return 'first';
  if (index === total - 1) return 'last';
  return 'middle';
};

const visibleTypingUsers = computed(() =>
  (props.typingUsers || []).filter((item) => item.conversationId === props.conversation.id),
);
const hasConversation = computed(() => Boolean(props.conversation.id));

const typingLabel = computed(() => {
  const users = visibleTypingUsers.value;
  if (users.length === 0) return '';
  if (users.length === 1) return `${users[0]?.displayName || 'Someone'} is typing`;
  if (users.length === 2) return `${users[0]?.displayName || 'Someone'} and ${users[1]?.displayName || 'someone'} are typing`;
  return `${users.length} people are typing`;
});

const isNearBottom = () => {
  const el = messagesEl.value;
  if (!el) return true;
  return el.scrollHeight - el.scrollTop - el.clientHeight < 96;
};

const scrollToBottom = () => {
  const el = messagesEl.value;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
  pendingNewMessage.value = false;
};

const queueScrollToBottom = () => {
  if (!import.meta.client) return;
  const frame = globalThis.requestAnimationFrame || ((callback: FrameRequestCallback) => window.setTimeout(callback, 16));
  frame(() => scrollToBottom());
};

const forceScrollToBottom = async () => {
  await nextTick();
  scrollToBottom();
  if (!import.meta.client) return;
  queueScrollToBottom();
  window.setTimeout(() => scrollToBottom(), 80);
  window.setTimeout(() => scrollToBottom(), 180);
};

const requestLoadOlder = () => {
  const el = messagesEl.value;
  if (el) {
    preservingOlderScroll.value = true;
    olderScrollHeight = el.scrollHeight;
    olderScrollTop = el.scrollTop;
  }
  emit('loadOlder');
};

watch(
  () => ({
    conversationId: props.conversation.id,
    lastMessageId: props.messages.at(-1)?.id || '',
    firstMessageId: props.messages[0]?.id || '',
    count: props.messages.length,
  }),
  async (current, previous) => {
    const wasNearBottom = isNearBottom();
    await nextTick();
    if (preservingOlderScroll.value) {
      const el = messagesEl.value;
      if (el) {
        el.scrollTop = olderScrollTop + (el.scrollHeight - olderScrollHeight);
      }
      preservingOlderScroll.value = false;
      return;
    }
    if (previous && current.conversationId === previous.conversationId && current.lastMessageId === previous.lastMessageId) {
      return;
    }
    if (previous && current.conversationId === previous.conversationId && !wasNearBottom) {
      pendingNewMessage.value = true;
      return;
    }
    scrollToBottom();
    queueScrollToBottom();
  },
  { immediate: true },
);

watch(
  () => props.conversation.id,
  () => {
    pendingNewMessage.value = false;
    preservingOlderScroll.value = false;
  },
);

watch(
  () => props.loading,
  (loading, previous) => {
    if (!loading && previous) {
      void forceScrollToBottom();
    }
  },
);
</script>

<template>
  <section class="thread panel">
    <header class="thread-header">
      <div v-if="loading" class="thread-title-skeleton">
        <USkeleton class="title-skeleton" />
        <USkeleton class="status-skeleton" />
      </div>
      <div v-else class="thread-title" :class="{ 'has-typing': typingLabel, empty: !hasConversation }">
        <h1>{{ conversation.title }}</h1>
        <p class="thread-status" :class="{ active: typingLabel }">
          <span v-if="typingLabel">{{ typingLabel }}</span>
          <span v-if="typingLabel" class="typing-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </p>
      </div>
      <div v-if="loading" class="thread-actions">
        <USkeleton class="member-skeleton" />
        <USkeleton class="data-skeleton" />
      </div>
      <div v-else-if="hasConversation" class="thread-actions">
        <UBadge v-if="conversation.members.length" class="member-count" color="neutral" variant="soft">
          {{ conversation.members.length }} members
        </UBadge>
        <UButton color="primary" variant="soft" size="xs" :disabled="!conversation.id" aria-label="Open conversation data" @click="emit('openDetails')">
          <Info :size="15" />
          Data
        </UButton>
      </div>
    </header>

    <div class="rls-banner">
      <MessageCircle :size="18" />
      <span>Messages are delivered live and remain available after reload.</span>
    </div>

    <div ref="messagesEl" class="messages">
      <div v-if="loading" class="message-skeletons">
        <USkeleton v-for="item in 4" :key="item" class="message-skeleton" />
      </div>
      <div v-else-if="!hasConversation" class="thread-empty-state">
        <MessageCircle :size="28" />
        <h2>Select a conversation</h2>
        <p>Choose a chat from the conversation list to read messages.</p>
      </div>
      <div v-else-if="messages.length === 0" class="thread-empty-state">
        <MessageCircle :size="28" />
        <h2>No messages yet</h2>
        <p>Send the first message to start this conversation.</p>
      </div>
      <template v-else>
        <UButton
          v-if="hasOlder"
          class="load-older"
          color="neutral"
          variant="soft"
          size="sm"
          :loading="loadingOlder"
          @click="requestLoadOlder"
        >
          Load older messages
        </UButton>
        <div
          v-for="group in groupedMessages"
          :key="group.key"
          class="message-group"
          :class="{ own: group.own }"
        >
          <div v-if="!group.own" class="bubble-author">{{ group.senderName }}</div>
          <MessageBubble
            v-for="(message, index) in group.messages"
            :key="message.id"
            :message="message"
            :own="group.own"
            :position="bubblePosition(index, group.messages.length)"
            :show-meta="index === group.messages.length - 1"
          />
        </div>
      </template>
      <UButton
        v-if="pendingNewMessage && !loading"
        class="new-message-jump"
        color="primary"
        variant="solid"
        size="sm"
        @click="scrollToBottom"
      >
        New messages
      </UButton>
    </div>

    <MessageComposer :disabled="composerDisabled || !hasConversation" @send="emit('send', $event)" @typing="emit('typing', $event)" />
  </section>
</template>
