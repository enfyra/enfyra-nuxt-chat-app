<script setup lang="ts">
import { Plus, Search, UserPlus, UsersRound, X } from 'lucide-vue-next';
import type { ChatUser } from '~/types/chat';

const props = defineProps<{
  currentUserId?: string;
  busy?: boolean;
}>();

const emit = defineEmits<{
  create: [payload: { members: ChatUser[] }];
}>();

const query = ref('');
const results = ref<ChatUser[]>([]);
const selected = ref<ChatUser[]>([]);
const loading = ref(false);
const isOpen = ref(false);
let searchTimer: ReturnType<typeof setTimeout> | null = null;
let searchRun = 0;

const mapUser = (value: any): ChatUser => ({
  id: value?.id || '',
  email: value?.email || '',
  displayName: value?.displayName || value?.display_name || value?.email || 'Unknown user',
  avatarUrl: value?.avatarUrl || value?.avatar_url || null,
  statusText: value?.statusText || value?.status_text || null,
  lastSeenAt: value?.lastSeenAt || value?.last_seen_at || null,
});

const canCreate = computed(() => selected.value.length >= 2 && !props.busy);

const openDialog = () => {
  isOpen.value = true;
  void searchUsers();
};

const closeDialog = () => {
  isOpen.value = false;
};

const searchUsers = async () => {
  const normalized = query.value.trim();
  const runId = ++searchRun;
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
    const response: any = await $fetch('/enfyra/user_definition', {
      query: {
        ...(filter ? { filter: JSON.stringify(filter) } : {}),
        limit: 8,
      },
    });
    if (runId !== searchRun) return;
    const selectedIds = new Set(selected.value.map((user) => user.id));
    results.value = (Array.isArray(response?.data) ? response.data : [])
      .map(mapUser)
      .filter((user: ChatUser) => user.id && user.id !== props.currentUserId && !selectedIds.has(user.id));
  } catch {
    if (runId !== searchRun) return;
    results.value = [];
  } finally {
    if (runId === searchRun) loading.value = false;
  }
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
  if (!canCreate.value) return;
  emit('create', {
    members: selected.value,
  });
  closeDialog();
  selected.value = [];
  query.value = '';
  results.value = [];
};

watch(query, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    void searchUsers();
  }, 280);
});

onMounted(() => {
  void searchUsers();
});

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer);
});
</script>

<template>
  <UCard class="create-group">
    <UButton class="create-entry" color="neutral" variant="ghost" block :disabled="busy" @click="openDialog">
      <span class="group-icon">
        <UsersRound :size="18" />
      </span>
      <div>
        <UBadge color="neutral" variant="soft">New group</UBadge>
        <h3>Create group chat</h3>
        <span>Choose 2-49 people</span>
      </div>
      <Plus :size="18" />
    </UButton>

    <Teleport to="body">
      <div v-if="isOpen" class="modal-backdrop" @click.self="closeDialog">
        <UCard class="group-dialog" role="dialog" aria-modal="true" aria-label="Create group chat">
          <header class="dialog-header">
            <div>
              <UBadge color="neutral" variant="soft">Create group</UBadge>
              <h2>New conversation</h2>
              <span>Select people first. You can rename the group later.</span>
            </div>
            <UButton color="neutral" variant="outline" square aria-label="Close" @click="closeDialog">
              <X :size="18" />
            </UButton>
          </header>

          <div v-if="selected.length" class="selected-block">
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
            <p v-if="loading" class="empty-state">Loading users...</p>
            <div v-for="user in results" :key="user.id" class="result-row">
              <span class="result-avatar">{{ user.displayName.slice(0, 1) }}</span>
              <span class="result-copy">
                <strong>{{ user.displayName }}</strong>
                <span>{{ user.email }}</span>
              </span>
              <UButton color="neutral" variant="soft" @click="addUser(user)">
                <UserPlus :size="15" />
                Add
              </UButton>
            </div>
            <p v-if="!loading && results.length === 0" class="empty-state">No users found.</p>
          </div>

          <footer class="dialog-footer">
            <UButton color="neutral" variant="ghost" @click="closeDialog">Cancel</UButton>
            <UButton :disabled="!canCreate" :loading="busy" @click="createGroup">
              {{ busy ? 'Creating' : 'Create group' }}
            </UButton>
          </footer>
        </UCard>
      </div>
    </Teleport>
  </UCard>
</template>
