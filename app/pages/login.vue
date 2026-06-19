<script setup lang="ts">
import { DatabaseZap, LockKeyhole, MessageSquareText, Network, RadioTower } from 'lucide-vue-next';

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
      <UCard class="login-card" :ui="{ root: 'login-card-root', body: 'login-card-body p-0 sm:p-0' }">
        <aside class="login-product-panel">
          <div class="login-copy">
            <UBadge color="primary" variant="soft" class="login-badge">Powered by Enfyra</UBadge>
            <h1>Enfyra Nuxt Chat</h1>
            <p class="muted">
              A third-party Nuxt app using Enfyra for auth, REST data, cookie refresh, and realtime Socket.IO.
            </p>
          </div>
          <div class="login-feature-list">
            <span><LockKeyhole :size="17" /> Auth and OAuth cookie bridge</span>
            <span><DatabaseZap :size="17" /> REST API through the app proxy</span>
            <span><RadioTower :size="17" /> Realtime chat over Socket.IO</span>
          </div>
        </aside>

        <form class="login-form" @submit.prevent="login">
          <div class="login-form-heading">
            <h2>Sign in</h2>
            <p>Use the demo account or continue with Google.</p>
          </div>
          <UFormField label="Email" class="login-form-field">
            <UInput v-model="email" autocomplete="email" size="xl" class="login-field" variant="subtle" />
          </UFormField>
          <UFormField label="Password" class="login-form-field">
            <UInput v-model="password" type="password" autocomplete="current-password" placeholder="Enter password" size="xl" class="login-field" variant="subtle" />
          </UFormField>
          <UAlert v-if="errorMessage" color="error" variant="soft" :title="errorMessage" />
          <UButton type="submit" size="xl" block :loading="isLoading" class="login-action-button login-primary-action">
            <LockKeyhole :size="18" />
            Continue
          </UButton>
          <UButton type="button" size="xl" color="neutral" variant="outline" block class="login-action-button google-button" @click="loginWithGoogle">
            <span class="google-mark" aria-hidden="true">G</span>
            Continue with Google
          </UButton>
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

.login-card {
  width: min(860px, calc(100vw - 32px));
  max-width: calc(100vw - 32px);
  height: fit-content;
  border-color: var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-panel);
  backdrop-filter: blur(16px);
  overflow: hidden;
}

.login-card :deep(.login-card-body) {
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(340px, 0.8fr);
  padding: 0;
}

.login-product-panel {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 32px;
  min-height: 430px;
  padding: 34px;
  border-right: 1px solid var(--border);
  background:
    radial-gradient(circle at 24% 12%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 15rem),
    var(--surface-elevated);
}

.login-copy {
  display: grid;
  gap: 12px;
}

.login-badge {
  width: fit-content;
}

.login-copy h1 {
  margin: 0;
  max-width: 12ch;
  font-size: 40px;
  line-height: 1.15;
  letter-spacing: 0;
}

.login-copy .muted {
  margin: 0;
  font-size: 14px;
  line-height: 1.55;
}

.login-feature-list {
  display: grid;
  gap: 10px;
}

.login-feature-list span {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--muted);
  color: var(--accent-strong);
  padding: 0 12px;
  font-size: 13px;
  font-weight: 700;
}

.login-form {
  display: grid;
  align-content: center;
  gap: 14px;
  padding: 34px;
}

.login-form-heading {
  display: grid;
  gap: 6px;
}

.login-form-heading h2 {
  margin: 0;
  font-size: 26px;
  line-height: 1.15;
}

.login-form-heading p {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 14px;
  line-height: 1.5;
}

.login-form-field :deep(label) {
  margin-bottom: 7px;
  color: var(--accent-strong);
  font-size: 13px;
  font-weight: 800;
}

.login-field {
  width: 100%;
}

.login-field :deep(input) {
  min-height: 42px;
  border: 1px solid var(--border);
  background: var(--muted);
  color: var(--foreground);
  box-shadow: none;
}

.login-field :deep(input:focus) {
  border-color: color-mix(in srgb, var(--accent) 58%, var(--border));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent);
}

.login-action-button {
  min-height: 42px;
  font-weight: 800;
}

.login-primary-action {
  border: 1px solid color-mix(in srgb, var(--accent) 46%, var(--border));
  background: var(--accent);
  color: var(--accent-text);
  box-shadow: 0 10px 22px color-mix(in srgb, var(--accent) 16%, transparent);
}

.google-button {
  border: 1px solid var(--border);
  background: var(--muted);
  color: var(--foreground);
}

.google-button:hover {
  background: color-mix(in srgb, var(--accent) 8%, var(--muted));
}

.login-note {
  display: flex;
  gap: 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--muted);
  color: var(--muted-foreground);
  padding: 10px;
  font-size: 12px;
  line-height: 1.5;
}

.google-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: #fff;
  color: #1a73e8;
  font-family: Arial, sans-serif;
  font-size: 13px;
  font-weight: 800;
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
    place-items: center;
  }

  .login-card {
    width: min(420px, calc(100vw - 32px));
  }

  .login-card :deep(.login-card-body) {
    grid-template-columns: 1fr;
  }

  .login-product-panel {
    min-height: auto;
    padding: 24px;
    border-right: 0;
    border-bottom: 1px solid var(--border);
  }

  .login-copy h1 {
    max-width: none;
    font-size: 28px;
  }

  .login-feature-list {
    display: none;
  }

  .login-form {
    padding: 24px;
  }
}

@media (max-width: 480px) {
  .login-card {
    width: min(420px, calc(100vw - 32px));
  }

  .login-copy h1 {
    font-size: 25px;
  }

  .brand > span:not(.brand-mark):not(.brand-powered) {
    display: none;
  }
}
</style>
