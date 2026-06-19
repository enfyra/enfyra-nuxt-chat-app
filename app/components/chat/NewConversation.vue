<script setup lang="ts">
import { MessageCircle, MessageSquarePlus, Search, UserPlus, UsersRound, X } from 'lucide-vue-next';
import type { ChatUser } from '~/types/chat';

const props = defineProps<{
  currentUserId?: string;
  busy?: boolean;
  compact?: boolean;
}>();

const emit = defineEmits<{
  startDm: [user: ChatUser];
  createGroup: [payload: { members: ChatUser[] }];
  modalOpenChange: [open: boolean];
}>();

const dmOpen = ref(false);
const groupOpen = ref(false);
const query = ref('');
const results = ref<ChatUser[]>([]);
const selected = ref<ChatUser[]>([]);
const loading = ref(false);
let searchTimer: ReturnType<typeof setTimeout> | null = null;
let searchRun = 0;

const mapUser = (value: any): ChatUser => ({
  id: value?.id || '',
  email: value?.email || '',
  displayName: value?.displayName || value?.email || 'Unknown user',
  avatarUrl: value?.avatarUrl || null,
  statusText: value?.statusText || null,
  lastSeenAt: value?.lastSeenAt || null,
});

const canCreateGroup = computed(() => selected.value.length >= 2 && !props.busy);
const compactItems = computed(() => [
  {
    label: 'Direct message',
    icon: 'i-lucide-message-circle',
    disabled: props.busy,
    onSelect: openDm,
  },
  {
    label: 'Group chat',
    icon: 'i-lucide-users-round',
    disabled: props.busy,
    onSelect: openGroup,
  },
]);
const modalOpen = computed({
  get: () => dmOpen.value || groupOpen.value,
  set: (value) => {
    if (!value) closeModal();
  },
});

const resetSearch = () => {
  query.value = '';
  results.value = [];
};

const openDm = () => {
  groupOpen.value = false;
  dmOpen.value = true;
  resetSearch();
  void searchUsers();
};

const openGroup = () => {
  dmOpen.value = false;
  groupOpen.value = true;
  resetSearch();
  void searchUsers();
};

const closeModal = () => {
  dmOpen.value = false;
  groupOpen.value = false;
};

const searchUsers = async () => {
  const normalized = query.value.trim();
  const runId = ++searchRun;
  results.value = [];
  loading.value = true;
  try {
    const filterClauses = [
      ...(props.currentUserId ? [{ id: { _neq: props.currentUserId } }] : []),
      ...(normalized
        ? [{
            _or: [
              { email: { _contains: normalized } },
              { displayName: { _contains: normalized } },
            ],
          }]
        : []),
    ];
    const filter = filterClauses.length ? { _and: filterClauses } : null;
    const response: any = await $fetch('/enfyra/enfyra_user', {
      query: {
        ...(filter ? { filter: JSON.stringify(filter) } : {}),
        limit: groupOpen.value ? 8 : 6,
      },
    });
    if (runId !== searchRun) return;
    const selectedIds = new Set(selected.value.map((user) => user.id));
    results.value = (Array.isArray(response?.data) ? response.data : [])
      .map(mapUser)
      .filter((user: ChatUser) => user.id && user.id !== props.currentUserId && (!groupOpen.value || !selectedIds.has(user.id)));
  } catch {
    if (runId !== searchRun) return;
    results.value = [];
  } finally {
    if (runId === searchRun) loading.value = false;
  }
};

const startDm = (user: ChatUser) => {
  emit('startDm', user);
  closeModal();
};

const addUser = (user: ChatUser) => {
  if (selected.value.some((item) => item.id === user.id)) return;
  selected.value = [...selected.value, user].slice(0, 49);
  results.value = results.value.filter((item) => item.id !== user.id);
};

const removeUser = (userId: string) => {
  selected.value = selected.value.filter((user) => user.id !== userId);
  void searchUsers();
};

const createGroup = () => {
  if (!canCreateGroup.value) return;
  emit('createGroup', { members: selected.value });
  selected.value = [];
  closeModal();
};

watch(query, () => {
  if (!dmOpen.value && !groupOpen.value) return;
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    void searchUsers();
  }, 280);
});

watch(modalOpen, (open) => {
  emit('modalOpenChange', open);
}, { flush: 'sync' });

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer);
});
</script>

<template>
  <div class="new-conversation" :class="{ 'new-conversation-compact': compact }">
    <UDropdownMenu
      v-if="compact"
      :items="compactItems"
      :content="{ align: 'end', sideOffset: 8 }"
    >
      <UButton
        color="neutral"
        variant="outline"
        square
        :disabled="busy"
        aria-label="New conversation"
        title="New conversation"
      >
        <MessageSquarePlus :size="18" />
      </UButton>
    </UDropdownMenu>
    <div v-else class="new-heading">
      <span>New conversation</span>
      <div class="quick-actions">
        <UButton color="neutral" variant="soft" size="xs" :disabled="busy" @click="openDm">
          <MessageCircle :size="14" />
          DM
        </UButton>
        <UButton color="neutral" variant="soft" size="xs" :disabled="busy" @click="openGroup">
          <UsersRound :size="14" />
          Group
        </UButton>
      </div>
    </div>

    <UModal
      v-model:open="modalOpen"
      :ui="{
        overlay: 'conversation-modal-overlay',
        content: 'conversation-modal-content',
      }"
    >
      <template #content>
        <UCard class="conversation-dialog" role="dialog" aria-modal="true" :aria-label="groupOpen ? 'Create group chat' : 'Start direct message'">
          <header class="dialog-header">
            <div>
              <h2>{{ groupOpen ? 'New group conversation' : 'New direct message' }}</h2>
              <span>{{ groupOpen ? 'Select people first. You can rename the group later.' : 'Search a user and start chatting.' }}</span>
            </div>
            <UButton color="neutral" variant="outline" square aria-label="Close" @click="closeModal">
              <X :size="18" />
            </UButton>
          </header>

          <div v-if="groupOpen && selected.length" class="selected-block">
            <div class="selected-header">
              <span>{{ selected.length + 1 }} members</span>
              <small>including you</small>
            </div>
            <div class="selected-list">
              <UButton v-for="user in selected" :key="user.id" class="selected-chip" color="neutral" variant="soft" @click="removeUser(user.id)">
                <span>{{ user.displayName }}</span>
                <X :size="14" />
              </UButton>
            </div>
          </div>

          <UInput v-model="query" placeholder="Search people" autofocus size="lg" class="search-field">
            <template #leading>
              <Search :size="17" />
            </template>
          </UInput>

          <div class="result-list">
            <div v-if="loading" class="modal-empty-state">
              <Search :size="22" />
              <strong>Searching users</strong>
              <span>Looking through Enfyra users...</span>
            </div>
            <div v-for="user in results" :key="user.id" class="result-row">
              <span class="result-avatar">{{ user.displayName.slice(0, 1) }}</span>
              <span class="result-copy">
                <strong>{{ user.displayName }}</strong>
                <span>{{ user.email }}</span>
              </span>
              <UButton v-if="groupOpen" color="neutral" variant="soft" @click="addUser(user)">
                <UserPlus :size="15" />
                Add
              </UButton>
              <UButton v-else color="primary" variant="soft" :disabled="busy" @click="startDm(user)">
                Message
              </UButton>
            </div>
            <div v-if="!loading && results.length === 0" class="modal-empty-state">
              <Search :size="22" />
              <strong>No users found</strong>
              <span>Try another name or email.</span>
            </div>
          </div>

          <footer v-if="groupOpen" class="dialog-footer">
            <UButton color="neutral" variant="ghost" @click="closeModal">Cancel</UButton>
            <UButton :disabled="!canCreateGroup" :loading="busy" @click="createGroup">
              {{ busy ? 'Creating' : 'Create group' }}
            </UButton>
          </footer>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
