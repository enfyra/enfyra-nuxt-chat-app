<script setup lang="ts">
import { Chrome, LockKeyhole, MessageSquareText, Network } from 'lucide-vue-next';

const email = ref('enfyra@admin.com');
const password = ref('');
const errorMessage = ref('');
const { isLoading, login: loginWithPassword, loginWithGoogle } = useAuth();

const login = async () => {
  errorMessage.value = '';
  try {
    await loginWithPassword({ email: email.value, password: password.value });
    await navigateTo('/chat');
  } catch (error: any) {
    errorMessage.value = error?.data?.message || error?.statusMessage || 'Login failed';
  }
};
</script>

<template>
  <main class="page-shell login-page">
    <div class="app-grid-bg" />
    <header class="login-header app-shell-container">
      <NuxtLink to="/chat" class="brand">
        <span class="brand-mark"><MessageSquareText :size="19" /></span>
        <span>Enfyra Chat</span>
        <span class="brand-powered">Powered by Enfyra</span>
      </NuxtLink>
      <ThemeToggle />
    </header>

    <section class="login-shell">
      <UCard class="login-form">
        <form class="login-form-inner" @submit.prevent="login">
          <div>
            <UBadge color="neutral" variant="soft">Powered by Enfyra</UBadge>
            <h1>Sign in to Enfyra Chat</h1>
            <p class="muted">Use the demo account or continue with Google to try a third-party app powered by Enfyra auth, REST, and realtime.</p>
          </div>
          <UFormField label="Email">
            <UInput v-model="email" autocomplete="email" size="xl" class="login-field" />
          </UFormField>
          <UFormField label="Password">
            <UInput v-model="password" type="password" autocomplete="current-password" placeholder="Enter password" size="xl" class="login-field" />
          </UFormField>
          <UButton type="submit" size="xl" block :loading="isLoading">
            <LockKeyhole :size="18" />
            Continue
          </UButton>
          <UButton type="button" size="xl" color="neutral" variant="outline" block @click="loginWithGoogle">
            <Chrome :size="18" />
            Continue with Google
          </UButton>
          <UAlert v-if="errorMessage" color="error" variant="soft" :title="errorMessage" />
          <div class="login-note">
            <Network :size="16" />
            <span>Enfyra powers the session, data API, and realtime socket behind this Nuxt chat app.</span>
          </div>
        </form>
      </UCard>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  position: relative;
  overflow: clip;
}

.login-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--header-height);
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 17px;
  font-weight: 700;
}

.login-shell {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 100%;
  min-height: calc(100vh - var(--header-height));
  padding: 24px 16px;
}

.login-form {
  width: min(calc(100vw - 32px), 420px);
  height: fit-content;
  background: color-mix(in srgb, var(--card) 88%, transparent);
  backdrop-filter: blur(18px);
}

.login-form-inner {
  display: grid;
  gap: 14px;
}

.login-form-inner h1 {
  margin: 0 0 8px;
  font-size: 24px;
  line-height: 1.15;
}

.login-form-inner .muted {
  font-size: 14px;
  line-height: 1.55;
}

.login-field {
  width: 100%;
}

.login-note {
  display: flex;
  gap: 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--docs-bg-subtle);
  color: var(--muted-foreground);
  padding: 10px;
  font-size: 12px;
  line-height: 1.5;
}

.login-form :deep(.text-xl) {
  font-size: 15px;
  line-height: 1.4;
}

.login-form :deep(.h-12) {
  min-height: 42px;
}

.login-note strong {
  color: var(--foreground);
}

@media (max-width: 860px) {
  .login-shell {
    align-items: flex-start;
    padding-top: 18px;
  }
}
</style>
