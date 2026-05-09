<script setup lang="ts">
import { Search, UserPlus } from 'lucide-vue-next';
import type { ChatUser } from '~/types/chat';

const props = defineProps<{
  currentUserId?: string;
  busy?: boolean;
}>();

const emit = defineEmits<{
  startDm: [user: ChatUser];
}>();

const query = ref('');
const results = ref<ChatUser[]>([]);
const loading = ref(false);
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

const searchUsers = async () => {
  const runId = ++searchRun;
  loading.value = true;
  try {
    const normalized = query.value.trim();
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
        limit: 6,
      },
    });
    if (runId !== searchRun) return;
    results.value = (Array.isArray(response?.data) ? response.data : [])
      .map(mapUser)
      .filter((user: ChatUser) => user.id && user.id !== props.currentUserId);
  } catch {
    if (runId !== searchRun) return;
    results.value = [];
  } finally {
    if (runId === searchRun) loading.value = false;
  }
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
  <UCard class="user-search">
    <div class="search-heading">
      <UBadge color="neutral" variant="soft">New message</UBadge>
      <span>Start a DM</span>
    </div>
    <UInput v-model="query" placeholder="Search people" size="lg" class="search-field">
      <template #leading>
        <Search :size="17" />
      </template>
    </UInput>
    <div class="result-list">
      <p v-if="loading" class="empty-state">Loading users...</p>
      <UButton v-for="user in results" :key="user.id" class="result-row" color="neutral" variant="ghost" :disabled="busy" @click="emit('startDm', user)">
        <span class="result-avatar">{{ user.displayName.slice(0, 1) }}</span>
        <span class="result-copy">
          <strong>{{ user.displayName }}</strong>
          <span>{{ user.email }}</span>
        </span>
        <UserPlus :size="17" />
      </UButton>
      <p v-if="!loading && results.length === 0" class="empty-state">No users found.</p>
    </div>
  </UCard>
</template>
