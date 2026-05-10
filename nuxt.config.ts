// https://nuxt.com/docs/api/configuration/nuxt-config
const enfyraAppUrl = (
  process.env.NUXT_PUBLIC_ENFYRA_APP_URL ||
  process.env.ENFYRA_APP_URL ||
  'https://demo.enfyra.io'
).replace(/\/+$/, '');
const enfyraApiUrl = `${enfyraAppUrl}/api`;

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  devServer: {
    host: '127.0.0.1',
    port: 3001,
  },
  modules: ['@nuxtjs/color-mode', '@nuxt/ui'],
  colorMode: {
    preference: 'dark',
    fallback: 'dark',
    classSuffix: '',
    storageKey: 'enfyra-chat-theme',
  },
  components: [
    {
      path: '~/components',
      pathPrefix: false,
    },
  ],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    enfyraApiUrl,
    public: {
      appName: 'Enfyra Demo Chat',
      enfyraAppUrl,
    },
  },
  routeRules: {
    '/enfyra/**': {
      ssr: false,
      cache: false,
      proxy: { to: `${enfyraApiUrl}/**`, fetchOptions: { redirect: 'manual' } },
    },
    '/socket.io/**': {
      ssr: false,
      cache: false,
      proxy: { to: `${enfyraAppUrl}/ws/socket.io/**` },
    },
  },
})
