<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next';

type GuideTab = 'flow' | 'enfyra' | 'nuxt';

interface GuideLink {
  label: string;
  tab: GuideTab;
  target: string;
}

interface GuideStep {
  id: string;
  icon: string;
  title: string;
  text: string;
  code: string;
  links?: GuideLink[];
}

const activeTab = ref<GuideTab>('flow');

const tabs = [
  {
    label: 'Runtime flow',
    value: 'flow',
    icon: 'i-lucide-route',
  },
  {
    label: 'Enfyra setup',
    value: 'enfyra',
    icon: 'i-lucide-server',
  },
  {
    label: 'Nuxt app',
    value: 'nuxt',
    icon: 'i-lucide-panels-top-left',
  },
];

const goTo = async (target: string, tab: GuideTab) => {
  activeTab.value = tab;
  await nextTick();
  document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (import.meta.client) {
    window.history.replaceState(null, '', `#${target}`);
  }
};

const eventMap = [
  {
    client: 'connect',
    server: '/chat gateway',
    serverLink: { label: 'Gateway auth', tab: 'enfyra' as const, target: 'enfyra-gateway' },
    clientLink: { label: 'Client connect', tab: 'nuxt' as const, target: 'nuxt-connect' },
    result: 'Enfyra authenticates the socket and joins user_<userId>.',
  },
  {
    client: 'chat:join',
    server: 'chat:join',
    serverLink: { label: 'Join handler', tab: 'enfyra' as const, target: 'enfyra-join' },
    clientLink: { label: 'Emit join', tab: 'nuxt' as const, target: 'nuxt-connect' },
    result: 'Server joins conversation:<id> rooms for this user.',
  },
  {
    client: 'chat:message',
    server: 'chat:message',
    serverLink: { label: 'Message handler', tab: 'enfyra' as const, target: 'enfyra-message' },
    clientLink: { label: 'Message listeners', tab: 'nuxt' as const, target: 'nuxt-listen-message' },
    result: 'Server broadcasts chat:message and replies chat:message:sent.',
  },
  {
    client: 'chat:new',
    server: 'chat:new',
    serverLink: { label: 'New chat handler', tab: 'enfyra' as const, target: 'enfyra-new' },
    clientLink: { label: 'New chat listener', tab: 'nuxt' as const, target: 'nuxt-listen-new' },
    result: 'Server creates conversation, replies to owner, emits to other members.',
  },
  {
    client: 'chat:typing',
    server: 'chat:typing',
    serverLink: { label: 'Typing handler', tab: 'enfyra' as const, target: 'enfyra-typing' },
    clientLink: { label: 'Typing listener', tab: 'nuxt' as const, target: 'nuxt-typing' },
    result: 'Server broadcasts typing state only inside the conversation room.',
  },
  {
    client: 'chat:read',
    server: 'chat:read',
    serverLink: { label: 'Read handler', tab: 'enfyra' as const, target: 'enfyra-read' },
    clientLink: { label: 'Read listener', tab: 'nuxt' as const, target: 'nuxt-read' },
    result: 'Server marks unread rows read and emits chat:read to member user rooms.',
  },
  {
    client: 'chat:presence',
    server: 'chat:presence',
    serverLink: { label: 'Presence handler', tab: 'enfyra' as const, target: 'enfyra-presence' },
    clientLink: { label: 'Presence listener', tab: 'nuxt' as const, target: 'nuxt-presence' },
    result: 'Server checks user_<id> room size and replies chat:presence:state.',
  },
];

const flowSteps: GuideStep[] = [
  {
    id: 'flow-login',
    icon: 'i-lucide-key-round',
    title: '1. Browser signs in through Enfyra cookies',
    text: 'The third app never mints its own auth token. Password login posts through the local /enfyra proxy, Enfyra App sets cookies on the third app origin, and every later REST or Socket.IO call reuses that browser session.',
    code: `// Nuxt third app
await $fetch('/enfyra/login', {
  method: 'POST',
  body: { email, password },
})

const me = await $fetch('/enfyra/me')`,
    links: [
      { label: 'Nuxt auth code', tab: 'nuxt', target: 'nuxt-auth' },
      { label: 'Route proxy setup', tab: 'nuxt', target: 'nuxt-config' },
    ],
  },
  {
    id: 'flow-oauth',
    icon: 'i-lucide-shield-check',
    title: '2. OAuth redirects back through the third app cookie bridge',
    text: 'Google must call back to Enfyra App, because Enfyra owns the OAuth provider config. Enfyra then redirects to the third app cookie bridge prefix, for example /enfyra/auth/set-cookies, so the browser receives cookies for the third app origin before landing on /chat.',
    code: `// Nuxt third app starts OAuth on Enfyra App
GET https://demo.enfyra.io/api/auth/google
  ?redirect=http://localhost:3001/chat
  &cookieBridgePrefix=/enfyra

// Google callback goes to Enfyra App
GET https://demo.enfyra.io/api/auth/google/callback

// Enfyra redirects back to the third app proxy
302 http://localhost:3001/enfyra/auth/set-cookies
  ?accessToken=...
  &refreshToken=...
  &redirect=http://localhost:3001/chat

// Third app proxy returns Set-Cookie and Location
302 Location: http://localhost:3001/chat
Set-Cookie: accessToken=...`,
    links: [
      { label: 'OAuth button code', tab: 'nuxt', target: 'nuxt-oauth' },
      { label: 'Proxy redirect rule', tab: 'nuxt', target: 'nuxt-config' },
      { label: 'Enfyra OAuth config', tab: 'enfyra', target: 'enfyra-oauth' },
    ],
  },
  {
    id: 'flow-connect',
    icon: 'i-lucide-plug-zap',
    title: '3. Client connects to the chat gateway',
    text: 'The browser connects to the Enfyra app websocket bridge. Enfyra authenticates the socket from cookies, loads @USER, and automatically joins the socket into user_<userId>.',
    code: `// Nuxt client
const socket = io('/chat', {
  withCredentials: true,
  transports: ['polling'],
  upgrade: false,
})

socket.on('connect', () => {
  socket.emit('chat:join')
})`,
    links: [
      { label: 'Client connect code', tab: 'nuxt', target: 'nuxt-connect' },
      { label: 'Gateway definition', tab: 'enfyra', target: 'enfyra-gateway' },
      { label: 'chat:join server handler', tab: 'enfyra', target: 'enfyra-join' },
    ],
  },
  {
    id: 'flow-join',
    icon: 'i-lucide-door-open',
    title: '4. chat:join maps the user to conversation rooms',
    text: 'The client emits chat:join once connected. The server handler queries memberships for @USER and joins conversation:<id> rooms. Those rooms are what later message, typing, read, and presence events use.',
    code: `// Enfyra websocket event script
const memberships = await @REPOS.chat_conversation_member.find({
  filter: { member: { id: { _eq: @USER.id } } },
  fields: 'conversation',
})

for (const membership of memberships.data || []) {
  @SOCKET.join('conversation:' + membership.conversation.id)
}`,
    links: [
      { label: 'Where client emits join', tab: 'nuxt', target: 'nuxt-connect' },
      { label: 'Server join script', tab: 'enfyra', target: 'enfyra-join' },
    ],
  },
  {
    id: 'flow-send-message',
    icon: 'i-lucide-send',
    title: '5. Sending a message is emit -> persist -> broadcast/reply',
    text: 'The composer emits chat:message. Enfyra checks membership, writes chat_message and read receipts, points chat_conversation.lastMessage to the persisted row, then broadcasts to conversation:<id> and replies with chat:message:sent.',
    code: `// Nuxt emits
socket.emit('chat:message', { conversationId, messageId, text })

// Enfyra handles
const created = await @REPOS.chat_message.create({ data: messageData })
await @REPOS.chat_conversation.update({ id: conversationId, data: { lastMessage: { id: created.data[0].id } } })
@SOCKET.broadcastToRoom('conversation:' + conversationId, 'chat:message', message)
@SOCKET.reply('chat:message:sent', message)`,
    links: [
      { label: 'Client emit', tab: 'nuxt', target: 'nuxt-emit-message' },
      { label: 'Server message handler', tab: 'enfyra', target: 'enfyra-message' },
      { label: 'Client listeners', tab: 'nuxt', target: 'nuxt-listen-message' },
    ],
  },
  {
    id: 'flow-new-chat',
    icon: 'i-lucide-message-circle-plus',
    title: '6. New DM/group is created only when the first message is sent',
    text: 'Selecting a new DM target creates a draft UI only. The server creates the conversation on chat:new, adds memberships, optionally persists the first message, replies to the owner, and emits to the other users.',
    code: `// Nuxt draft -> first send
socket.emit('chat:new', { kind: 'dm', memberIds, text, requestId })

// Enfyra notifies
@SOCKET.reply('chat:new', payload)
@SOCKET.emitToUser(memberId, 'chat:new', payload)`,
    links: [
      { label: 'Client draft/send', tab: 'nuxt', target: 'nuxt-new-chat' },
      { label: 'Server chat:new', tab: 'enfyra', target: 'enfyra-new' },
      { label: 'Client chat:new listener', tab: 'nuxt', target: 'nuxt-listen-new' },
    ],
  },
  {
    id: 'flow-presence',
    icon: 'i-lucide-radio',
    title: '7. Online presence checks Socket.IO user rooms, not the database',
    text: 'The client already knows which users it needs to observe. Every heartbeat it sends those user IDs; Enfyra checks roomSize(user_<id>) and replies with online state. No membership query is needed for the heartbeat path.',
    code: `// Nuxt heartbeat
socket.emit('chat:presence', { userIds })

// Enfyra script
const sockets = await @SOCKET.roomSize('user_' + userId)
@SOCKET.reply('chat:presence:state', { users })`,
    links: [
      { label: 'Client presence heartbeat', tab: 'nuxt', target: 'nuxt-presence' },
      { label: 'Server presence probe', tab: 'enfyra', target: 'enfyra-presence' },
    ],
  },
  {
    id: 'flow-typing-read',
    icon: 'i-lucide-badge-check',
    title: '8. Typing and read receipts use the same room model',
    text: 'Typing is transient room broadcast. Read state is persisted in chat_message_read, then faned out to member user rooms so every open tab can clear unread state.',
    code: `// Typing
socket.emit('chat:typing', { conversationId, isTyping: true })
@SOCKET.broadcastToRoom('conversation:' + conversationId, 'chat:typing', payload)

// Read
socket.emit('chat:read', { conversationId, readAt })
@SOCKET.emitToCurrentRoom('user_' + memberId, 'chat:read', payload)`,
    links: [
      { label: 'Client typing', tab: 'nuxt', target: 'nuxt-typing' },
      { label: 'Server typing handler', tab: 'enfyra', target: 'enfyra-typing' },
      { label: 'Client read', tab: 'nuxt', target: 'nuxt-read' },
      { label: 'Server read handler', tab: 'enfyra', target: 'enfyra-read' },
    ],
  },
];

const enfyraSteps: GuideStep[] = [
  {
    id: 'enfyra-oauth',
    icon: 'i-lucide-shield-check',
    title: 'Configure OAuth as an Enfyra-owned identity flow',
    text: 'The OAuth provider belongs to Enfyra App. The third app only passes an absolute redirect and a cookieBridgePrefix. With autoSetCookies enabled, Enfyra ignores appCallbackUrl and redirects tokens to redirect.origin + cookieBridgePrefix + /auth/set-cookies.',
    code: `oauth_config_definition
  provider: google
  redirectUri: https://demo.enfyra.io/api/auth/google/callback
  autoSetCookies: true
  appCallbackUrl: null

OAuth start query
  redirect: http://localhost:3001/chat
  cookieBridgePrefix: /enfyra

Computed token bridge
  http://localhost:3001/enfyra/auth/set-cookies`,
    links: [
      { label: 'OAuth runtime flow', tab: 'flow', target: 'flow-oauth' },
      { label: 'Nuxt OAuth button', tab: 'nuxt', target: 'nuxt-oauth' },
      { label: 'Proxy config', tab: 'nuxt', target: 'nuxt-config' },
    ],
  },
  {
    id: 'enfyra-users',
    icon: 'i-lucide-users-round',
    title: 'Use user_definition as chat users',
    text: 'The demo uses Enfyra users directly. Display fields live on user_definition so auth, membership, and profile display all point to the same identity.',
    code: `user_definition
  displayName
  avatarUrl
  statusText`,
  },
  {
    id: 'enfyra-schema',
    icon: 'i-lucide-database',
    title: 'Create chat tables and indexes',
    text: 'Conversation membership is the visibility boundary. Read receipts are separate rows so unread can be queried with member + isRead indexes. Messages use a conversation + createdAt + id index for cursor pagination. The conversation list reads the latest preview through lastMessage, and DELETE /chat_message hooks repair that relation when the latest message is removed.',
    code: `chat_conversation
  kind, title, description
  createdBy -> user_definition
  lastMessage -> chat_message

chat_conversation_member
  conversation -> chat_conversation
  member -> user_definition
  index: member, id
  index: conversation, id

chat_message
  conversation -> chat_conversation
  sender -> user_definition
  index: conversation, createdAt, id

chat_message_read
  message -> chat_message
  conversation -> chat_conversation
  member -> user_definition
  index: member, isRead, id
  index: conversation, member, isRead`,
  },
  {
    id: 'enfyra-rls',
    icon: 'i-lucide-lock-keyhole',
    title: 'RLS pre-hooks merge membership filters',
    text: 'REST reads pass through pre-hooks before the default handler runs. The hook adds the membership boundary to @QUERY.filter so users only see conversations and messages they belong to.',
    code: `const userId = @USER?.id;
if (!userId) @THROW401('Unauthorized');

@QUERY.filter = {
  _and: [
    @QUERY.filter,
    { memberships: { member: { id: { _eq: userId } } } },
  ],
};`,
  },
  {
    id: 'enfyra-gateway',
    icon: 'i-lucide-server',
    title: 'Create /chat websocket gateway',
    text: 'The gateway requires auth. Enfyra loads @USER from the socket session and auto-joins user_<userId>, which is later used by chat:new and presence.',
    code: `websocket_definition
  path: /chat
  requireAuth: true

authenticated connection
  @USER is available
  socket joins user_<@USER.id> automatically`,
    links: [
      { label: 'Client connect', tab: 'nuxt', target: 'nuxt-connect' },
      { label: 'Runtime connect flow', tab: 'flow', target: 'flow-connect' },
    ],
  },
  {
    id: 'enfyra-join',
    icon: 'i-lucide-door-open',
    title: 'Handle chat:join',
    text: 'This event joins all conversation rooms for the authenticated user. The client emits it after connect and after refreshing conversation membership.',
    code: `const memberships = await @REPOS.chat_conversation_member.find({
  filter: { member: { id: { _eq: @USER.id } } },
  deep: {},
  fields: 'conversation',
  limit: 500,
});

for (const row of memberships.data || []) {
  const conversationId = row.conversation?.id || row.conversation;
  if (conversationId) @SOCKET.join('conversation:' + conversationId);
}

@SOCKET.reply('chat:joined', { joined: memberships.data?.length || 0 });`,
    links: [
      { label: 'Client emits chat:join', tab: 'nuxt', target: 'nuxt-connect' },
      { label: 'Room flow', tab: 'flow', target: 'flow-join' },
    ],
  },
  {
    id: 'enfyra-message',
    icon: 'i-lucide-message-square-text',
    title: 'Handle chat:message',
    text: 'The handler verifies membership, writes chat_message with read receipts, stores the persisted message as chat_conversation.lastMessage, then broadcasts and replies. Clients still render optimistically, but other clients only receive messages that have been persisted.',
    code: `const message = { id: messageId, conversationId, senderId, text, createdAt };

const created = await @REPOS.chat_message.create({
  data: { text, conversation: { id: conversationId }, sender: { id: senderId }, readReceipts },
});

await @REPOS.chat_conversation.update({
  id: conversationId,
  data: { lastMessage: { id: created.data[0].id }, updatedAt: created.data[0].createdAt },
});

@SOCKET.broadcastToRoom('conversation:' + conversationId, 'chat:message', message);
@SOCKET.reply('chat:message:sent', message);`,
    links: [
      { label: 'Client emit', tab: 'nuxt', target: 'nuxt-emit-message' },
      { label: 'Client listeners', tab: 'nuxt', target: 'nuxt-listen-message' },
    ],
  },
  {
    id: 'enfyra-new',
    icon: 'i-lucide-message-circle-plus',
    title: 'Handle chat:new',
    text: 'This is the only place a new conversation is created. The owner gets a reply for request resolution; other members get emitToUser so their open tabs refresh conversation list.',
    code: `const conversation = await @REPOS.chat_conversation.create({ data });
await @REPOS.chat_conversation_member.create({ data: memberships });

const payload = { requestId, conversationId, kind };
@SOCKET.reply('chat:new', payload);

for (const memberId of memberIds) {
  if (memberId !== ownerId) @SOCKET.emitToUser(memberId, 'chat:new', payload);
}`,
    links: [
      { label: 'Client starts draft', tab: 'nuxt', target: 'nuxt-new-chat' },
      { label: 'Client listens chat:new', tab: 'nuxt', target: 'nuxt-listen-new' },
    ],
  },
  {
    id: 'enfyra-presence',
    icon: 'i-lucide-activity',
    title: 'Handle chat:presence',
    text: 'Presence is a room-size probe. The server checks user_<id> rooms and replies only to the requesting socket. No DB query runs on this heartbeat path.',
    code: `const requestedIds = Array.isArray(@BODY.userIds) ? @BODY.userIds : [];
const users = [];

for (const userId of requestedIds.slice(0, 100)) {
  const sockets = await @SOCKET.roomSize('user_' + userId);
  users.push({ userId, isOnline: sockets > 0, sockets });
}

@SOCKET.reply('chat:presence:state', { users, seenAt });`,
    links: [
      { label: 'Client heartbeat', tab: 'nuxt', target: 'nuxt-presence' },
      { label: 'Presence flow', tab: 'flow', target: 'flow-presence' },
    ],
  },
  {
    id: 'enfyra-typing',
    icon: 'i-lucide-pen-line',
    title: 'Handle chat:typing',
    text: 'The server does not persist typing. It checks membership, then broadcasts the current user identity and isTyping state to the conversation room. Clients keep the state alive by emitting while the input still has text.',
    code: `${'${membershipCheckSource()}'}
@SOCKET.broadcastToRoom('conversation:' + @BODY.conversationId, 'chat:typing', {
  conversationId: @BODY.conversationId,
  senderId: @USER.id,
  sender: {
    id: @USER.id,
    email: @USER.email,
    displayName: @USER.displayName || @USER.email,
  },
  isTyping: @BODY.isTyping === true,
});`,
    links: [
      { label: 'Client emits typing', tab: 'nuxt', target: 'nuxt-typing' },
      { label: 'Runtime typing/read flow', tab: 'flow', target: 'flow-typing-read' },
    ],
  },
  {
    id: 'enfyra-read',
    icon: 'i-lucide-check-check',
    title: 'Handle chat:read',
    text: 'The server marks unread chat_message_read rows as read for @USER, then emits chat:read to every member user room. That makes other tabs for the same user clear their unread dot too.',
    code: `${'${membershipCheckSource()}'}
await Promise.all((unreadRows.data || []).map((row) =>
  @REPOS.chat_message_read.update({
    id: row.id,
    data: { isRead: true, readAt },
  })
));

for (const row of recipients.data || []) {
  const memberId = row.member?.id || row.member;
  if (memberId) {
    @SOCKET.emitToCurrentRoom('user_' + memberId, 'chat:read', payload);
  }
}`,
    links: [
      { label: 'Client emits/listens read', tab: 'nuxt', target: 'nuxt-read' },
      { label: 'Unread schema', tab: 'enfyra', target: 'enfyra-schema' },
      { label: 'Runtime typing/read flow', tab: 'flow', target: 'flow-typing-read' },
    ],
  },
];

const nuxtSteps: GuideStep[] = [
  {
    id: 'nuxt-install',
    icon: 'i-lucide-package-plus',
    title: 'Install Nuxt UI and Socket.IO client',
    text: 'The app is a normal Nuxt SSR app. Nuxt UI provides the interface components; socket.io-client talks to the Enfyra websocket gateway.',
    code: `yarn dlx nuxi init enfyra-nuxt-chat-app
yarn add @nuxt/ui tailwindcss @nuxtjs/color-mode socket.io-client`,
  },
  {
    id: 'nuxt-config',
    icon: 'i-lucide-settings',
    title: 'Configure Nuxt for Enfyra',
    text: 'REST and cookie-bridge calls use the local /enfyra/** prefix. The proxy must keep redirects manual so OAuth set-cookie responses reach the browser as a real 302 with Set-Cookie. Socket.IO uses the /chat namespace and local /socket.io transport path, which Nuxt proxies to the Enfyra app bridge.',
    code: `const enfyraAppUrl = 'https://demo.enfyra.io'
const enfyraApiUrl = \`\${enfyraAppUrl}/api\`

export default defineNuxtConfig({
  modules: ['@nuxtjs/color-mode', '@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  routeRules: {
    '/enfyra/**': {
      ssr: false,
      cache: false,
      proxy: {
        to: \`\${enfyraApiUrl}/**\`,
        fetchOptions: { redirect: 'manual' },
      },
    },
    '/socket.io/**': {
      ssr: false,
      cache: false,
      proxy: { to: \`\${enfyraAppUrl}/ws/socket.io/**\` },
    },
  },
  runtimeConfig: {
    public: { enfyraAppUrl },
  },
})`,
    links: [
      { label: 'Login flow', tab: 'flow', target: 'flow-login' },
      { label: 'OAuth flow', tab: 'flow', target: 'flow-oauth' },
      { label: 'Connect flow', tab: 'flow', target: 'flow-connect' },
    ],
  },
  {
    id: 'nuxt-auth',
    icon: 'i-lucide-key-round',
    title: 'Use Enfyra auth through a composable and middleware',
    text: 'The composable calls /enfyra/login, /enfyra/logout, and /enfyra/me for password sessions. Route middleware checks /me before entering protected pages, including /, so an anonymous user goes directly to /login without first rendering /chat.',
    code: `const login = async ({ email, password }) => {
  await $fetch('/enfyra/login', { method: 'POST', body: { email, password } })
  return await $fetch('/enfyra/me')
}

export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login' || to.path === '/how-it-works') return

  const user = await fetchUser()
  if (to.path === '/') return navigateTo(user ? '/chat' : '/login')
  if (!user) return navigateTo('/login')
})`,
    links: [
      { label: 'Server user model', tab: 'enfyra', target: 'enfyra-users' },
      { label: 'Runtime login flow', tab: 'flow', target: 'flow-login' },
    ],
  },
  {
    id: 'nuxt-oauth',
    icon: 'i-lucide-shield-check',
    title: 'Start Google OAuth with redirect and cookieBridgePrefix',
    text: 'The third app starts OAuth on Enfyra App because the provider callback URL is configured there. It passes an absolute redirect for the final page and cookieBridgePrefix for the token bridge. The prefix can be /enfyra because this app proxies /enfyra/** to Enfyra /api/**.',
    code: `const loginWithGoogle = () => {
  const redirectUrl = new URL('/chat', window.location.origin)
  const oauthUrl = new URL('/api/auth/google', enfyraAppUrl)

  oauthUrl.searchParams.set('redirect', redirectUrl.toString())
  oauthUrl.searchParams.set('cookieBridgePrefix', '/enfyra')

  window.location.href = oauthUrl.toString()
}`,
    links: [
      { label: 'OAuth runtime flow', tab: 'flow', target: 'flow-oauth' },
      { label: 'Enfyra OAuth config', tab: 'enfyra', target: 'enfyra-oauth' },
      { label: 'Proxy redirect rule', tab: 'nuxt', target: 'nuxt-config' },
    ],
  },
  {
    id: 'nuxt-load-data',
    icon: 'i-lucide-database',
    title: 'Load conversations, unread, and message pages',
    text: 'The UI sends direct filters for the current view. Enfyra hooks still enforce visibility. Messages load newest 20 first, then older messages use cursor pagination and meta filter counts.',
    code: `await $fetch('/enfyra/chat_conversation_member', {
  query: {
    filter: JSON.stringify({ member: { id: { _eq: me.id } } }),
    deep: JSON.stringify({ conversation: {} }),
  },
})

await $fetch('/enfyra/chat_message', {
  query: {
    filter: JSON.stringify({
      conversation: { id: { _eq: conversationId } },
      _or: [
        { createdAt: { _lt: cursor.createdAt } },
        { createdAt: { _eq: cursor.createdAt }, id: { _lt: cursor.id } },
      ],
    }),
    sort: '-createdAt,-id',
    limit: 20,
    meta: 'filterCount',
  },
})`,
    links: [
      { label: 'RLS hooks', tab: 'enfyra', target: 'enfyra-rls' },
      { label: 'Chat schema and indexes', tab: 'enfyra', target: 'enfyra-schema' },
    ],
  },
  {
    id: 'nuxt-connect',
    icon: 'i-lucide-plug-zap',
    title: 'Connect and join rooms',
    text: 'After Socket.IO connects, the app emits chat:join. The server catches that event and joins all conversation rooms for the authenticated user.',
    code: `const socket = io('/chat', {
  withCredentials: true,
  transports: ['polling'],
  upgrade: false,
})

socket.on('connect', () => {
  socket.emit('chat:join')
})

socket.on('chat:joined', () => {
  socketState.value = 'connected'
})`,
    links: [
      { label: 'Server gateway', tab: 'enfyra', target: 'enfyra-gateway' },
      { label: 'Server chat:join', tab: 'enfyra', target: 'enfyra-join' },
      { label: 'Runtime connect flow', tab: 'flow', target: 'flow-connect' },
    ],
  },
  {
    id: 'nuxt-emit-message',
    icon: 'i-lucide-send',
    title: 'Emit chat:message from the composer',
    text: 'The composer creates an optimistic message, then emits chat:message. If the socket is offline, the composer is disabled until reconnect succeeds.',
    code: `socket.emit('chat:message', {
  conversationId: activeConversation.id,
  messageId: pendingId,
  text,
})`,
    links: [
      { label: 'Server handles chat:message', tab: 'enfyra', target: 'enfyra-message' },
      { label: 'Client listens for result', tab: 'nuxt', target: 'nuxt-listen-message' },
      { label: 'Runtime message flow', tab: 'flow', target: 'flow-send-message' },
    ],
  },
  {
    id: 'nuxt-listen-message',
    icon: 'i-lucide-radio-receiver',
    title: 'Listen for chat:message and chat:message:sent',
    text: 'Room broadcasts arrive as chat:message. The sender also receives chat:message:sent, which resolves the optimistic message. Both events use the same upsert path.',
    code: `const onMessage = (message) => {
  upsertMessage(message)
  touchConversationPreview(message.conversationId, message.text, message.createdAt)
}

socket.on('chat:message', onMessage)
socket.on('chat:message:sent', onMessage)`,
    links: [
      { label: 'Server broadcast/reply', tab: 'enfyra', target: 'enfyra-message' },
      { label: 'Where client emits', tab: 'nuxt', target: 'nuxt-emit-message' },
    ],
  },
  {
    id: 'nuxt-new-chat',
    icon: 'i-lucide-message-circle-plus',
    title: 'Start a new DM or group',
    text: 'Selecting people only opens a draft UI. The conversation is created by Enfyra on chat:new when the first message or group creation request is sent.',
    code: `socket.emit('chat:new', {
  requestId,
  kind: 'dm',
  memberIds: [target.id],
  text,
})`,
    links: [
      { label: 'Server creates conversation', tab: 'enfyra', target: 'enfyra-new' },
      { label: 'Client listens chat:new', tab: 'nuxt', target: 'nuxt-listen-new' },
      { label: 'Runtime new-chat flow', tab: 'flow', target: 'flow-new-chat' },
    ],
  },
  {
    id: 'nuxt-listen-new',
    icon: 'i-lucide-bell-ring',
    title: 'Listen for chat:new',
    text: 'The owner resolves the pending request. Other members refresh their conversation list and join new rooms so future messages arrive live.',
    code: `socket.on('chat:new', async (payload) => {
  await refreshConversations({ silent: true })
  socket.emit('chat:join')
  resolvePendingRequest(payload.requestId, payload.conversationId)
})`,
    links: [
      { label: 'Server emits chat:new', tab: 'enfyra', target: 'enfyra-new' },
      { label: 'Client connect/join', tab: 'nuxt', target: 'nuxt-connect' },
    ],
  },
  {
    id: 'nuxt-presence',
    icon: 'i-lucide-activity',
    title: 'Probe online users by room state',
    text: 'The client computes the users it can currently see and asks Enfyra for their online state every 15 seconds. The UI expires online state after 45 seconds if probes stop.',
    code: `const userIds = visibleConversations
  .flatMap(conversation => conversation.members)
  .map(member => member.id)

socket.emit('chat:presence', { userIds })

socket.on('chat:presence:state', (payload) => {
  for (const user of payload.users) {
    setOnline(user.userId, user.isOnline)
  }
})`,
    links: [
      { label: 'Server presence probe', tab: 'enfyra', target: 'enfyra-presence' },
      { label: 'Runtime presence flow', tab: 'flow', target: 'flow-presence' },
    ],
  },
  {
    id: 'nuxt-typing',
    icon: 'i-lucide-pen-line',
    title: 'Emit and listen for typing state',
    text: 'The input emits chat:typing while it has text. Incoming chat:typing events update the header typing label and expire after a short timeout if no fresh signal arrives.',
    code: `socket.emit('chat:typing', {
  conversationId: activeConversation.id,
  isTyping: text.length > 0,
})

socket.on('chat:typing', (payload) => {
  if (payload.senderId === me.id) return
  updateTypingUsers(payload)
})`,
    links: [
      { label: 'Server typing handler', tab: 'enfyra', target: 'enfyra-typing' },
      { label: 'Runtime typing/read flow', tab: 'flow', target: 'flow-typing-read' },
    ],
  },
  {
    id: 'nuxt-read',
    icon: 'i-lucide-check-check',
    title: 'Emit and listen for read state',
    text: 'When a conversation is opened or receives a message while active, the client emits chat:read. Incoming chat:read clears the unread marker for that conversation.',
    code: `socket.emit('chat:read', {
  conversationId: activeConversation.id,
  readAt: new Date().toISOString(),
})

socket.on('chat:read', (payload) => {
  setConversationUnread(payload.conversationId, false)
})`,
    links: [
      { label: 'Server read handler', tab: 'enfyra', target: 'enfyra-read' },
      { label: 'Unread schema', tab: 'enfyra', target: 'enfyra-schema' },
      { label: 'Runtime typing/read flow', tab: 'flow', target: 'flow-typing-read' },
    ],
  },
];
</script>

<template>
  <main class="page-shell how-page">
    <div class="app-grid-bg" />
    <header class="app-header">
      <div class="how-header app-shell-container">
        <UButton to="/chat" variant="ghost" color="neutral" :ui="{ base: 'gap-2' }">
          <ArrowLeft :size="17" />
          Back to chat
        </UButton>
        <ThemeToggle />
      </div>
    </header>

    <section class="how-layout app-shell-container">
      <div class="how-hero">
        <UBadge color="neutral" variant="soft">Powered by Enfyra</UBadge>
        <h1>How this Enfyra-powered realtime chat demo works</h1>
        <p>
          Trace the same message from browser login, through Socket.IO emit, into Enfyra event scripts, and back to the Nuxt client listeners that update the UI.
        </p>
      </div>

      <UCard class="event-map">
        <div class="event-map-header">
          <div>
            <UBadge color="neutral" variant="soft">Event map</UBadge>
            <h2>Client emit, server handler, client listener</h2>
          </div>
          <p>Use these links as the shortest path between the Nuxt code and the Enfyra-powered event script that handles it.</p>
        </div>
        <div class="event-map-grid">
          <div v-for="event in eventMap" :key="event.client" class="event-map-row">
            <button type="button" class="event-chip" @click="goTo(event.clientLink.target, event.clientLink.tab)">
              {{ event.client }}
            </button>
            <span class="event-arrow">→</span>
            <button type="button" class="event-chip server" @click="goTo(event.serverLink.target, event.serverLink.tab)">
              {{ event.server }}
            </button>
            <p>{{ event.result }}</p>
          </div>
        </div>
      </UCard>

      <UTabs v-model="activeTab" :items="tabs" variant="link" size="lg" class="how-tabs">
        <template #content="{ item }">
          <div v-if="item.value === 'flow'" class="tab-panel">
            <UCard v-for="step in flowSteps" :id="step.id" :key="step.id" class="guide-card">
              <div class="guide-grid">
                <div class="guide-copy">
                  <div class="guide-heading">
                    <UAvatar :icon="step.icon" size="md" />
                    <div>
                      <UBadge color="neutral" variant="soft">Runtime</UBadge>
                      <h2>{{ step.title }}</h2>
                    </div>
                  </div>
                  <p>{{ step.text }}</p>
                  <div v-if="step.links?.length" class="guide-links">
                    <button v-for="link in step.links" :key="`${step.id}-${link.target}`" type="button" @click="goTo(link.target, link.tab)">
                      {{ link.label }}
                    </button>
                  </div>
                </div>
                <pre class="code-body guide-code">{{ step.code }}</pre>
              </div>
            </UCard>
          </div>

          <div v-else-if="item.value === 'enfyra'" class="tab-panel">
            <UCard v-for="(step, index) in enfyraSteps" :id="step.id" :key="step.id" class="guide-card">
              <div class="guide-grid">
                <div class="guide-copy">
                  <div class="guide-heading">
                    <UAvatar :icon="step.icon" size="md" />
                    <div>
                      <UBadge color="neutral" variant="soft">Enfyra {{ index + 1 }}</UBadge>
                      <h2>{{ step.title }}</h2>
                    </div>
                  </div>
                  <p>{{ step.text }}</p>
                  <div v-if="step.links?.length" class="guide-links">
                    <button v-for="link in step.links" :key="`${step.id}-${link.target}`" type="button" @click="goTo(link.target, link.tab)">
                      {{ link.label }}
                    </button>
                  </div>
                </div>
                <pre class="code-body guide-code">{{ step.code }}</pre>
              </div>
            </UCard>
          </div>

          <div v-else class="tab-panel">
            <UCard v-for="(step, index) in nuxtSteps" :id="step.id" :key="step.id" class="guide-card">
              <div class="guide-grid">
                <div class="guide-copy">
                  <div class="guide-heading">
                    <UAvatar :icon="step.icon" size="md" />
                    <div>
                      <UBadge color="neutral" variant="soft">Nuxt {{ index + 1 }}</UBadge>
                      <h2>{{ step.title }}</h2>
                    </div>
                  </div>
                  <p>{{ step.text }}</p>
                  <div v-if="step.links?.length" class="guide-links">
                    <button v-for="link in step.links" :key="`${step.id}-${link.target}`" type="button" @click="goTo(link.target, link.tab)">
                      {{ link.label }}
                    </button>
                  </div>
                </div>
                <pre class="code-body guide-code">{{ step.code }}</pre>
              </div>
            </UCard>
          </div>
        </template>
      </UTabs>
    </section>
  </main>
</template>

<style scoped>
.how-page {
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
}

.how-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--header-height);
}

.how-layout {
  position: relative;
  z-index: 1;
  padding: 46px 0 72px;
}

.how-hero {
  max-width: 66rem;
  margin-bottom: 28px;
}

.how-hero h1 {
  max-width: 60rem;
  margin: 14px 0 0;
  font-size: clamp(2.35rem, 5.8vw, 4.6rem);
  font-weight: 720;
  letter-spacing: 0;
  line-height: 1;
}

.how-hero p {
  max-width: 52rem;
  margin: 18px 0 0;
  color: var(--muted-foreground);
  font-size: 18px;
  line-height: 1.7;
}

.how-tabs {
  max-width: 80rem;
}

.event-map {
  max-width: 80rem;
  margin-bottom: 18px;
}

.event-map-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 18px;
}

.event-map-header h2 {
  margin: 8px 0 0;
  font-size: 22px;
  font-weight: 700;
}

.event-map-header p {
  max-width: 28rem;
  margin: 0;
  color: var(--muted-foreground);
  line-height: 1.6;
}

.event-map-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.event-map-row {
  display: grid;
  grid-template-columns: minmax(7rem, auto) auto minmax(7rem, auto) 1fr;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--docs-border);
  border-radius: var(--radius);
  background: var(--docs-bg-subtle);
  padding: 10px;
}

.event-map-row p {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 13px;
  line-height: 1.45;
}

.event-chip {
  min-height: 32px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--background);
  color: var(--foreground);
  padding: 5px 9px;
  font-size: 12px;
  font-weight: 700;
  text-align: left;
}

.event-chip.server {
  background: var(--primary);
  color: var(--primary-foreground);
}

.event-chip:hover {
  border-color: var(--ring);
}

.event-arrow {
  color: var(--muted-foreground);
}

.tab-panel {
  display: grid;
  gap: 14px;
  margin-top: 18px;
}

.guide-card {
  scroll-margin-top: calc(var(--header-height) + 18px);
  overflow: hidden;
}

.guide-grid {
  display: grid;
  grid-template-columns: minmax(18rem, 0.82fr) minmax(0, 1.18fr);
  gap: 20px;
  align-items: start;
}

.guide-heading {
  display: flex;
  align-items: center;
  gap: 12px;
}

.guide-heading h2 {
  margin: 7px 0 0;
  font-size: 20px;
  font-weight: 650;
}

.guide-copy p {
  margin: 16px 0 0;
  color: var(--muted-foreground);
  line-height: 1.7;
}

.guide-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.guide-links button {
  border: 1px solid var(--docs-border);
  border-radius: var(--radius);
  background: var(--docs-bg-subtle);
  color: var(--foreground);
  padding: 7px 10px;
  font-size: 12px;
  font-weight: 650;
}

.guide-links button:hover {
  background: var(--docs-bg-hover);
}

.guide-code {
  max-height: 30rem;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--code-bg);
  color: var(--code-text);
}

@media (max-width: 900px) {
  .event-map-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .event-map-grid {
    grid-template-columns: 1fr;
  }

  .event-map-row {
    grid-template-columns: 1fr auto 1fr;
  }

  .event-map-row p {
    grid-column: 1 / -1;
  }

  .guide-grid {
    grid-template-columns: 1fr;
  }
}
</style>
