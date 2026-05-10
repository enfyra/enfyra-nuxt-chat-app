<script setup lang="ts">
import { Search } from 'lucide-vue-next';
import type { ChatListItem, ChatUser } from '~/types/chat';

const props = defineProps<{
  items: ChatListItem[];
  activeId: string;
  loading?: boolean;
  currentUserId?: string;
  creatingChat?: boolean;
  showCreator?: boolean;
  onlineUserIds?: ReadonlySet<string>;
}>();

const emit = defineEmits<{
  select: [id: string];
  startDm: [user: ChatUser];
  createGroup: [payload: { members: ChatUser[] }];
  modalOpenChange: [open: boolean];
}>();

const query = ref('');
const filteredItems = computed(() => {
  const term = query.value.trim().toLowerCase();
  if (!term) {
    return props.items;
  }

  return props.items.filter(({ conversation, members }) => {
    const memberText = members.map((user) => `${user.displayName} ${user.email}`).join(' ');
    return `${conversation.title} ${conversation.lastMessageText || ''} ${memberText}`.toLowerCase().includes(term);
  });
});
</script>

<template>
  <aside class="conversation-list panel">
    <div class="list-header">
      <div>
        <p class="eyebrow">My chats</p>
        <h2>Conversations</h2>
      </div>
    </div>

    <div class="search-wrap">
      <UInput
        v-model="query"
        placeholder="Search conversations"
        size="md"
        variant="subtle"
        class="search-input"
        :ui="{ base: 'h-11 text-[15px]', leading: 'ps-3', leadingIcon: 'size-4' }"
      >
        <template #leading>
          <Search :size="17" />
        </template>
      </UInput>
    </div>

    <NewConversation
      v-if="showCreator"
      class="embedded-new-conversation"
      :current-user-id="currentUserId"
      :busy="creatingChat"
      @start-dm="emit('startDm', $event)"
      @create-group="emit('createGroup', $event)"
      @modal-open-change="emit('modalOpenChange', $event)"
    />

    <div class="conversation-scroll">
      <div v-if="loading" class="loading-list">
        <USkeleton v-for="item in 4" :key="item" class="loading-row" />
      </div>
      <template v-else>
        <ConversationRow
          v-for="item in filteredItems"
          :key="item.conversation.id"
          :item="item"
          :active="item.conversation.id === activeId"
          :current-user-id="currentUserId"
          :online-user-ids="onlineUserIds"
          @select="emit('select', $event)"
        />
      </template>
      <p v-if="!loading && filteredItems.length === 0" class="empty-state">No conversations match this search.</p>
    </div>
  </aside>
</template>
