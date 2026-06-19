import { Client } from '/Users/thinhdo/Documents/enfyra/mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { StdioClientTransport } from '/Users/thinhdo/Documents/enfyra/mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';

const apiUrl = process.env.ENFYRA_API_URL || 'http://localhost:3000/api';
const email = process.env.ENFYRA_EMAIL || 'enfyra@admin.com';
const password = process.env.ENFYRA_PASSWORD || '1234';
const writeDelayMs = Number(process.env.ENFYRA_SETUP_WRITE_DELAY_MS || 700);
const heavyWriteDelayMs = Number(process.env.ENFYRA_SETUP_HEAVY_WRITE_DELAY_MS || 1200);

const writeTools = new Set([
  'create_record',
  'update_record',
  'delete_record',
  'create_column',
  'delete_column',
]);

const heavyWriteTools = new Set([
  'create_table',
  'update_table',
  'delete_table',
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let directAccessToken = null;

const settleAfterCall = async (name) => {
  if (heavyWriteTools.has(name) && heavyWriteDelayMs > 0) {
    await sleep(heavyWriteDelayMs);
    return;
  }
  if (writeTools.has(name) && writeDelayMs > 0) {
    await sleep(writeDelayMs);
  }
};

const transport = new StdioClientTransport({
  command: 'node',
  args: ['/Users/thinhdo/Documents/enfyra/mcp-server/src/index.mjs'],
  env: { ...process.env, ENFYRA_API_URL: apiUrl, ENFYRA_EMAIL: email, ENFYRA_PASSWORD: password },
});

const client = new Client({ name: 'enfyra-demo-chat-setup', version: '1.0.0' });

const textOf = (result) => result.content?.map((item) => item.text || '').join('\n') || '';

const jsonFromText = (text) => {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {}
  const starts = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '{') starts.push(index);
  }
  const end = text.lastIndexOf('}');
  for (const start of starts) {
    if (end < start) continue;
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {}
  }
  return null;
};

const call = async (name, args = {}) => {
  const result = await client.callTool({ name, arguments: args });
  const text = textOf(result);
  process.stdout.write(`mcp:${name}\n`);
  const json = jsonFromText(text);
  if (json?.success === false || json?.statusCode >= 400 || text.includes('API error')) {
    throw new Error(`${name} failed: ${text}`);
  }
  if (!json) {
    throw new Error(`${name} returned non-JSON output: ${text}`);
  }
  await settleAfterCall(name);
  return { text, json };
};

const directRequest = async (path, options = {}) => {
  if (!directAccessToken) {
    const loginResponse = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!loginResponse.ok) {
      throw new Error(`direct auth failed: ${loginResponse.status} ${await loginResponse.text()}`);
    }
    const loginJson = await loginResponse.json();
    directAccessToken = loginJson.data?.accessToken || loginJson.accessToken;
    if (!directAccessToken) throw new Error('direct auth failed: missing access token');
  }
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${directAccessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`direct ${options.method || 'GET'} ${path} failed: ${response.status} ${text}`);
  }
  return json;
};

const patchTableDirect = async (tableId, body) => {
  const result = await directRequest(`/table_definition/${tableId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  const preview = Array.isArray(result?.data) ? result.data[0] : result?.data;
  if (preview?._preview && preview?.requiredConfirmHash) {
    return directRequest(`/table_definition/${tableId}?schemaConfirmHash=${preview.requiredConfirmHash}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }
  return result;
};

const query = async (tableName, filter = undefined, options = {}) => {
  const result = await call('query_table', {
    tableName,
    ...(filter ? { filter: JSON.stringify(filter) } : {}),
    limit: options.limit || 50,
    ...(options.fields ? { fields: options.fields } : {}),
    ...(options.sort ? { sort: options.sort } : {}),
  });
  return result.json?.data || [];
};

const tableByName = async (name) => {
  const rows = await query('table_definition', { name: { _eq: name } }, { limit: 1 });
  return rows[0] || null;
};

const routeByPath = async (path) => {
  const rows = await query('route_definition', { path: { _eq: path } }, { limit: 1 });
  return rows[0] || null;
};

const roleByName = async (name) => {
  const rows = await query('role_definition', { name: { _eq: name } }, { limit: 1 });
  return rows[0] || null;
};

const methodByName = async (method) => {
  const rows = await query('method_definition', { method: { _eq: method } }, { limit: 1 });
  return rows[0] || null;
};

const preHookByName = async (name) => {
  const rows = await query('pre_hook_definition', { name: { _eq: name } }, { limit: 1 });
  return rows[0] || null;
};

const postHookByName = async (name) => {
  const rows = await query('post_hook_definition', { name: { _eq: name } }, { limit: 1 });
  return rows[0] || null;
};

const routePermissionByRouteRole = async (routeId, roleId) => {
  const rows = await query('route_permission_definition', {
    route: { id: { _eq: String(routeId) } },
    role: { id: { _eq: String(roleId) } },
  }, { limit: 1 });
  return rows[0] || null;
};

const flowByName = async (name) => {
  const rows = await query('flow_definition', { name: { _eq: name } }, { limit: 1 });
  return rows[0] || null;
};

const wsByPath = async (path) => {
  const rows = await query('websocket_definition', { path: { _eq: path } }, { limit: 1 });
  return rows[0] || null;
};

const eventByName = async (gatewayId, eventName) => {
  const rows = await query('websocket_event_definition', {
    gateway: { id: { _eq: gatewayId } },
    eventName: { _eq: eventName },
  }, { limit: 1 });
  return rows[0] || null;
};

const updateTableConstraints = async (table, { indexes, uniques }) => {
  if (!table?.id || (!indexes && !uniques)) return table;
  await call('update_table', {
    tableId: String(table.id),
    ...(indexes ? { indexes: JSON.stringify(indexes) } : {}),
    ...(uniques ? { uniques: JSON.stringify(uniques) } : {}),
  });
  return tableByName(table.name);
};

const mergeRelationsForPatch = (existingRelations = [], desiredRelations = []) => {
  return desiredRelations.map((relation) => {
    const existing = existingRelations.find((item) => item.propertyName === relation.propertyName);
    return {
      ...(existing?.id ? { id: existing.id } : {}),
      type: relation.type,
      propertyName: relation.propertyName,
      ...(relation.inversePropertyName ? { inversePropertyName: relation.inversePropertyName } : {}),
      isNullable: relation.isNullable ?? true,
      onDelete: relation.onDelete || 'SET NULL',
      targetTable: typeof relation.targetTable === 'object' ? relation.targetTable.id : relation.targetTable,
    };
  });
};

const updateTableRelations = async (table, relations) => {
  if (!table?.id || !relations) return table;
  const inspected = await call('inspect_table', { tableName: table.name });
  const meta = inspected.json?.table;
  const mergedRelations = mergeRelationsForPatch(meta?.relations || [], relations);
  await patchTableDirect(String(table.id), { relations: mergedRelations });
  await sleep(heavyWriteDelayMs);
  return tableByName(table.name);
};

const createTableIfMissing = async ({ name, description, columns, relations, indexes, uniques }) => {
  const existing = await tableByName(name);
  if (existing) {
    const relationUpdated = await updateTableRelations(existing, relations);
    return updateTableConstraints(relationUpdated, { indexes, uniques });
  }
  await call('create_table', {
    name,
    description,
    columns: JSON.stringify(columns),
    relations: relations?.length ? JSON.stringify(relations) : undefined,
    indexes: indexes?.length ? JSON.stringify(indexes) : undefined,
    uniques: uniques?.length ? JSON.stringify(uniques) : undefined,
  });
  return tableByName(name);
};

const createRecord = async (tableName, data) => {
  const result = await call('create_record', { tableName, data: JSON.stringify(data) });
  return result.json?.data?.[0] || result.json?.data || result.json;
};

const updateRecord = async (tableName, id, data) => {
  const result = await call('update_record', { tableName, id: String(id), data: JSON.stringify(data) });
  return result.json?.data?.[0] || result.json?.data || result.json;
};

const deleteRecord = async (tableName, id) => {
  const result = await call('delete_record', { tableName, id: String(id) });
  return result.json?.data?.[0] || result.json?.data || result.json;
};

const ensureRole = async (name, description) => {
  const existing = await roleByName(name);
  if (existing) return existing;
  return createRecord('role_definition', { name, description });
};

const ensureRoutePermission = async ({ routePath, roleId, methods, description }) => {
  const route = await routeByPath(routePath);
  if (!route) return null;
  const methodRows = (await Promise.all(methods.map((method) => methodByName(method)))).filter(Boolean);
  const data = {
    isEnabled: true,
    description,
    route: { id: route.id },
    role: { id: roleId },
    methods: methodRows.map((method) => ({ id: method.id })),
  };
  const existing = await routePermissionByRouteRole(route.id, roleId);
  if (existing) return updateRecord('route_permission_definition', existing.id, data);
  return createRecord('route_permission_definition', data);
};

const ensurePreHook = async ({ name, routePath, methods, sourceCode, description, priority = 0 }) => {
  const route = await routeByPath(routePath);
  if (!route) return null;
  const methodRows = (await Promise.all(methods.map((method) => methodByName(method)))).filter(Boolean);
  const data = {
    name,
    description,
    sourceCode,
    scriptLanguage: 'typescript',
    priority,
    isEnabled: true,
    isGlobal: false,
    isSystem: false,
    route: { id: route.id },
    methods: methodRows.map((method) => ({ id: method.id })),
  };
  const existing = await preHookByName(name);
  if (existing) return updateRecord('pre_hook_definition', existing.id, data);
  return createRecord('pre_hook_definition', data);
};

const ensurePostHook = async ({ name, routePath, methods, sourceCode, description, priority = 0 }) => {
  const route = await routeByPath(routePath);
  if (!route) return null;
  const methodRows = (await Promise.all(methods.map((method) => methodByName(method)))).filter(Boolean);
  const data = {
    name,
    description,
    sourceCode,
    scriptLanguage: 'typescript',
    priority,
    isEnabled: true,
    isGlobal: false,
    isSystem: false,
    route: { id: route.id },
    methods: methodRows.map((method) => ({ id: method.id })),
  };
  const existing = await postHookByName(name);
  if (existing) return updateRecord('post_hook_definition', existing.id, data);
  return createRecord('post_hook_definition', data);
};

const ensureUserColumn = async (tableId, existingColumns, column) => {
  if (existingColumns.some((item) => item.name === column.name)) return;
  await call('create_column', {
    tableId: String(tableId),
    name: column.name,
    type: column.type,
    isNullable: column.isNullable ?? true,
  });
};

const ensureTableColumn = async (tableName, column) => {
  const table = await call('inspect_table', { tableName });
  const meta = table.json?.table;
  if (!meta?.id) return;
  await ensureUserColumn(meta.id, meta.columns || [], column);
};

const deleteTableColumnIfExists = async (tableName, columnName) => {
  const table = await call('inspect_table', { tableName });
  const meta = table.json?.table;
  const column = meta?.columns?.find((item) => item.name === columnName);
  if (!meta?.id || !column?.id) return;
  await call('delete_column', {
    tableId: String(meta.id),
    columnId: String(column.id),
  });
};

const deleteRelationIfExists = async (tableName, propertyName) => {
  const table = await tableByName(tableName);
  if (!table?.id) return;
  const rows = await query('relation_definition', {
    propertyName: { _eq: propertyName },
    sourceTable: { id: { _eq: String(table.id) } },
  }, { limit: 20 });
  for (const row of rows) {
    await deleteRecord('relation_definition', row.id);
  }
};

const ensureUser = async (data) => {
  const rows = await query('user_definition', { email: { _eq: data.email } }, { limit: 1 });
  if (rows[0]) {
    return updateRecord('user_definition', rows[0].id, {
      displayName: data.displayName,
      avatarUrl: data.avatarUrl,
      statusText: data.statusText,
    });
  }
  return createRecord('user_definition', data);
};

const ensureConversation = async (data) => {
  const rows = await query('chat_conversation', { title: { _eq: data.title } }, { limit: 1 });
  if (rows[0]) {
    const update = {
      kind: data.kind,
      description: data.description,
    };
    if (data.lastMessageId) {
      update.lastMessage = { id: data.lastMessageId };
    }
    await updateRecord('chat_conversation', rows[0].id, update);
    return rows[0];
  }
  return createRecord('chat_conversation', data);
};

const ensureMembership = async ({ conversationId, userId, role, joinedAt }) => {
  if (!conversationId || !userId) return null;
  const rows = await query('chat_conversation_member', {
    conversation: { id: { _eq: String(conversationId) } },
    member: { id: { _eq: String(userId) } },
  }, { limit: 1 });
  if (rows[0]) return rows[0];
  return createRecord('chat_conversation_member', {
    role,
    joinedAt: joinedAt,
    conversation: { id: conversationId },
    member: { id: userId },
  });
};

const ensureMessage = async ({ text, conversationId, senderId }) => {
  if (!conversationId || !senderId) return null;
  const rows = await query('chat_message', {
    text: { _eq: text },
    conversation: { id: { _eq: String(conversationId) } },
    sender: { id: { _eq: String(senderId) } },
  }, { limit: 1 });
  if (rows[0]) return rows[0];
  return createRecord('chat_message', {
    text,
    persistStatus: 'persisted',
    conversation: { id: conversationId },
    sender: { id: senderId },
  });
};

const ensureReadReceipt = async ({ messageId, conversationId, memberId, isRead, readAt }) => {
  if (!messageId || !conversationId || !memberId) return null;
  const rows = await query('chat_message_read', {
    message: { id: { _eq: messageId } },
    member: { id: { _eq: memberId } },
  }, { limit: 1 });
  if (rows[0]) {
    return updateRecord('chat_message_read', rows[0].id, {
      isRead: isRead,
      readAt: readAt || null,
    });
  }
  return createRecord('chat_message_read', {
    isRead: isRead,
    readAt: readAt || null,
    message: { id: messageId },
    conversation: { id: conversationId },
    member: { id: memberId },
  });
};

const membershipCheckSource = (bodyExpression = '@BODY.conversationId') => `
const userId = @USER?.id;
const conversationId = ${bodyExpression};
if (!userId) @THROW401('Unauthorized');
if (!conversationId) @THROW400('conversationId is required');
const originalDeep = @QUERY?.deep;
if (@QUERY) @QUERY.deep = {};
const currentMembership = await @REPOS.chat_conversation_member.find({
  filter: {
    conversation: { id: { _eq: conversationId } },
    member: { id: { _eq: userId } },
  },
  deep: {},
  fields: 'id',
  limit: 1,
});
if (@QUERY) @QUERY.deep = originalDeep;
if (!currentMembership.data?.length) @THROW403('Not a conversation member');
`;

const mergeFilterSource = (filterExpression) => `
const userId = @USER?.id;
if (!userId) @THROW401('Unauthorized');
if (!@USER?.isRootAdmin) {
  const incomingFilter = @QUERY.filter;
  const scopeFilter = ${filterExpression};
  @QUERY.filter = Object.keys(incomingFilter).length
    ? { _and: [incomingFilter, scopeFilter] }
    : scopeFilter;
}
`;

const visibleConversationScopeSource = (filterExpression) => `
const userId = @USER?.id;
if (!userId) @THROW401('Unauthorized');
if (!@USER?.isRootAdmin) {
  const originalDeep = @QUERY.deep;
  @QUERY.deep = {};
  const visibleMemberships = await @REPOS.chat_conversation_member.find({
    filter: {
      member: { id: { _eq: userId } },
    },
    deep: {},
    fields: 'conversation',
    limit: 500,
  });
  @QUERY.deep = originalDeep;
  const conversationIds = (visibleMemberships.data || [])
    .map((row) => row.conversation?.id || row.conversation)
    .filter(Boolean);
  const incomingFilter = @QUERY.filter;
  const scopeFilter = conversationIds.length
    ? ${filterExpression}
    : { id: { _is_null: true } };
  @QUERY.filter = Object.keys(incomingFilter).length
    ? { _and: [incomingFilter, scopeFilter] }
    : scopeFilter;
}
`;

const conversationReadScopeSource = () => visibleConversationScopeSource(`{
    id: { _in: conversationIds },
  }`);

const membershipReadScopeSource = () => visibleConversationScopeSource(`{
    conversation: { id: { _in: conversationIds } },
  }`);

const messageReadScopeSource = () => visibleConversationScopeSource(`{
    conversation: { id: { _in: conversationIds } },
  }`);

const receiptReadScopeSource = () => mergeFilterSource(`{
    member: { id: { _eq: userId } },
  }`);

const messageWriteScopeSource = () => `
const userId = @USER?.id;
if (!userId) @THROW401('Unauthorized');
const conversationId = @BODY?.conversation?.id || @BODY?.conversationId;
if (!conversationId) @THROW400('conversation is required');
const originalDeep = @QUERY?.deep;
if (@QUERY) @QUERY.deep = {};
const currentMembership = await @REPOS.chat_conversation_member.find({
  filter: {
    conversation: { id: { _eq: conversationId } },
    member: { id: { _eq: userId } },
  },
  deep: {},
  fields: 'id',
  limit: 1,
});
if (@QUERY) @QUERY.deep = originalDeep;
if (!currentMembership.data?.length) @THROW403('Not a conversation member');
@BODY.sender = { id: userId };
@BODY.conversation = { id: conversationId };
`;

const messageDeleteSnapshotSource = () => `
const userId = @USER?.id;
const messageId = @PARAMS?.id;
if (!userId) @THROW401('Unauthorized');
if (!messageId) @THROW400('message id is required');
const messageResult = await @REPOS.chat_message.find({
  filter: { id: { _eq: messageId } },
  deep: {},
  fields: 'id,createdAt,conversation',
  limit: 1,
});
const message = messageResult.data?.[0];
if (!message?.id) return;
const conversationId = message.conversation?.id || message.conversation;
if (!conversationId) return;
const conversationResult = await @REPOS.chat_conversation.find({
  filter: { id: { _eq: conversationId } },
  deep: {},
  fields: 'id,lastMessage',
  limit: 1,
});
const conversation = conversationResult.data?.[0];
const currentLastId = conversation?.lastMessage?.id || conversation?.lastMessage;
const membershipResult = await @REPOS.chat_conversation_member.find({
  filter: {
    conversation: { id: { _eq: conversationId } },
    member: { id: { _eq: userId } },
  },
  deep: {},
  fields: 'id',
  limit: 1,
});
if (!membershipResult.data?.length) @THROW403('Not a conversation member');
@SHARE.deletedChatMessage = {
  id: message.id,
  conversationId,
  createdAt: message.createdAt,
  wasLastMessage: String(currentLastId || '') === String(message.id),
};
`;

const messageDeleteLastMessageRepairSource = () => `
const deleted = @SHARE?.deletedChatMessage;
if (!deleted?.conversationId || !deleted?.id) return;
if (!deleted.wasLastMessage) return;
const nextLastResult = await @REPOS.chat_message.find({
  filter: { conversation: { id: { _eq: deleted.conversationId } } },
  deep: {},
  fields: 'id',
  sort: '-createdAt,-id',
  limit: 1,
});
const nextLast = nextLastResult.data?.[0];
await @REPOS.chat_conversation.update({
  id: deleted.conversationId,
  data: {
    lastMessage: nextLast?.id ? { id: nextLast.id } : null,
    updatedAt: new Date().toISOString(),
  },
});
`;

const conversationTitleResponseSource = () => `
const currentUserId = @USER?.id;
const rows = Array.isArray(@DATA?.data) ? @DATA.data : [];
const applyTitle = async (conversation) => {
  if (!conversation?.id || conversation.kind !== 'dm') return conversation;
  const originalDeep = @QUERY.deep;
  @QUERY.deep = {};
  const memberships = await @REPOS.chat_conversation_member.find({
    filter: {
      conversation: { id: { _eq: conversation.id } },
    },
    deep: {},
    fields: 'member.id,member.email,member.displayName',
    limit: 2,
  });
  @QUERY.deep = originalDeep;
  const other = (memberships.data || [])
    .map((row) => row.member)
    .find((member) => (member?.id || member) !== currentUserId);
  const displayTitle = other?.displayName || other?.email || conversation.title || 'Direct message';
  conversation.title = displayTitle;
  conversation.displayTitle = displayTitle;
  return conversation;
};

for (const row of rows) {
  if (row?.conversation) {
    await applyTitle(row.conversation);
  } else {
    await applyTitle(row);
  }
}
`;

const setup = async () => {
  await client.connect(transport);

  const userTable = await call('inspect_table', { tableName: 'user_definition' });
  const userMeta = userTable.json?.table;
  await ensureUserColumn(userMeta.id, userMeta.columns, { name: 'displayName', type: 'varchar' });
  await ensureUserColumn(userMeta.id, userMeta.columns, { name: 'avatarUrl', type: 'varchar' });
  await ensureUserColumn(userMeta.id, userMeta.columns, { name: 'statusText', type: 'varchar' });
  await deleteRelationIfExists('user_definition', 'createdConversations');
  await deleteRelationIfExists('user_definition', 'chatMemberships');
  await deleteRelationIfExists('user_definition', 'chatMessages');
  await deleteRelationIfExists('user_definition', 'chatReadReceipts');

  const freshUserTable = await tableByName('user_definition');
  const conversation = await createTableIfMissing({
    name: 'chat_conversation',
    description: 'Demo chat conversations for DM and group rooms.',
    columns: [
      { name: 'kind', type: 'varchar', isNullable: false },
      { name: 'title', type: 'varchar', isNullable: true },
      { name: 'description', type: 'text', isNullable: true },
    ],
    relations: [
      { targetTable: freshUserTable.id, type: 'many-to-one', propertyName: 'createdBy', isNullable: true, onDelete: 'CASCADE' },
    ],
  });

  const member = await createTableIfMissing({
    name: 'chat_conversation_member',
    description: 'Demo chat membership rows used for RLS-style filtering.',
    columns: [
      { name: 'role', type: 'varchar', isNullable: false },
      { name: 'joinedAt', type: 'date', isNullable: true },
    ],
    relations: [
      { targetTable: conversation.id, type: 'many-to-one', propertyName: 'conversation', inversePropertyName: 'memberships', isNullable: false, onDelete: 'CASCADE' },
      { targetTable: freshUserTable.id, type: 'many-to-one', propertyName: 'member', isNullable: false, onDelete: 'CASCADE' },
    ],
  });
  await deleteTableColumnIfExists('chat_conversation_member', 'deleted_at');

  const message = await createTableIfMissing({
    name: 'chat_message',
    description: 'Demo chat messages persisted by websocket-triggered flow.',
    columns: [
      { name: 'text', type: 'text', isNullable: false },
      { name: 'persistStatus', type: 'varchar', isNullable: true },
    ],
    relations: [
      { targetTable: conversation.id, type: 'many-to-one', propertyName: 'conversation', inversePropertyName: 'messages', isNullable: false, onDelete: 'CASCADE' },
      { targetTable: freshUserTable.id, type: 'many-to-one', propertyName: 'sender', isNullable: false, onDelete: 'CASCADE' },
    ],
    indexes: [
      ['conversation', 'createdAt', 'id'],
    ],
  });
  await updateTableRelations(conversation, [
    { targetTable: freshUserTable.id, type: 'many-to-one', propertyName: 'createdBy', isNullable: true, onDelete: 'CASCADE' },
    { targetTable: message.id, type: 'many-to-one', propertyName: 'lastMessage', isNullable: true, onDelete: 'SET NULL' },
  ]);
  await deleteTableColumnIfExists('chat_conversation', 'lastMessageText');
  await deleteTableColumnIfExists('chat_conversation', 'lastMessageAt');

  const readReceipt = await createTableIfMissing({
    name: 'chat_message_read',
    description: 'Per-user read state for demo chat messages.',
    columns: [
      { name: 'isRead', type: 'boolean', isNullable: false },
      { name: 'readAt', type: 'date', isNullable: true },
    ],
    relations: [
      { targetTable: message.id, type: 'many-to-one', propertyName: 'message', inversePropertyName: 'readReceipts', isNullable: false, onDelete: 'CASCADE' },
      { targetTable: conversation.id, type: 'many-to-one', propertyName: 'conversation', inversePropertyName: 'readReceipts', isNullable: false, onDelete: 'CASCADE' },
      { targetTable: freshUserTable.id, type: 'many-to-one', propertyName: 'member', isNullable: false, onDelete: 'CASCADE' },
    ],
    indexes: [
      ['member', 'isRead', 'conversation'],
      ['member', 'isRead', 'id'],
      ['conversation', 'member', 'isRead'],
    ],
    uniques: [
      ['message', 'member'],
    ],
  });

  const now = new Date().toISOString();
  const me = (await query('user_definition', { email: { _eq: email } }, { limit: 1 }))[0];
  await updateRecord('user_definition', me.id, {
    displayName: 'Thinh Do',
    statusText: 'Building with Enfyra',
  });

  const users = [
    me,
    await ensureUser({ email: 'mai@enfyra.dev', password: '1234', isRootAdmin: false, isSystem: false, displayName: 'Mai Tran', statusText: 'Reviewing runtime traces' }),
    await ensureUser({ email: 'long@enfyra.dev', password: '1234', isRootAdmin: false, isSystem: false, displayName: 'Long Pham', statusText: 'Online' }),
    await ensureUser({ email: 'linh@enfyra.dev', password: '1234', isRootAdmin: false, isSystem: false, displayName: 'Linh Nguyen', statusText: 'Testing flows' }),
    await ensureUser({ email: 'khoa@enfyra.dev', password: '1234', isRootAdmin: false, isSystem: false, displayName: 'Khoa Le', statusText: 'Offline' }),
  ];

  const userRole = await ensureRole('user', 'Demo chat app user role.');
  for (const item of users.filter((user) => !user.isRootAdmin)) {
    await updateRecord('user_definition', item.id, { role: { id: userRole.id } });
  }

  await ensureRoutePermission({
    routePath: '/user_definition',
    roleId: userRole.id,
    methods: ['GET'],
    description: 'Allow chat users to search visible user profiles.',
  });
  await ensureRoutePermission({
    routePath: '/chat_conversation',
    roleId: userRole.id,
    methods: ['GET', 'POST', 'PATCH'],
    description: 'Allow chat users to use conversations scoped by hooks.',
  });
  await ensureRoutePermission({
    routePath: '/chat_conversation_member',
    roleId: userRole.id,
    methods: ['GET', 'POST', 'DELETE'],
    description: 'Allow chat users to use memberships scoped by hooks.',
  });
  await ensureRoutePermission({
    routePath: '/chat_message',
    roleId: userRole.id,
    methods: ['GET', 'POST', 'DELETE'],
    description: 'Allow chat users to use messages scoped by hooks.',
  });
  await ensureRoutePermission({
    routePath: '/chat_message_read',
    roleId: userRole.id,
    methods: ['GET'],
    description: 'Allow chat users to check their own unread message state.',
  });

  await ensurePreHook({
    name: 'Demo chat conversation RLS',
    routePath: '/chat_conversation',
    methods: ['GET'],
    description: 'Restrict conversation reads to conversations containing @USER.',
    priority: 0,
    sourceCode: conversationReadScopeSource(),
  });
  await ensurePreHook({
    name: 'Demo chat membership RLS',
    routePath: '/chat_conversation_member',
    methods: ['GET'],
    description: 'Restrict membership reads to conversations containing @USER.',
    priority: 0,
    sourceCode: membershipReadScopeSource(),
  });
  await ensurePreHook({
    name: 'Demo chat message read RLS',
    routePath: '/chat_message',
    methods: ['GET'],
    description: 'Restrict message reads to conversations containing @USER.',
    priority: 0,
    sourceCode: messageReadScopeSource(),
  });
  await ensurePreHook({
    name: 'Demo chat receipt read RLS',
    routePath: '/chat_message_read',
    methods: ['GET'],
    description: 'Restrict read receipt queries to the current user.',
    priority: 0,
    sourceCode: receiptReadScopeSource(),
  });
  await ensurePreHook({
    name: 'Demo chat message write RLS',
    routePath: '/chat_message',
    methods: ['POST'],
    description: 'Restrict message writes to conversations containing @USER and force sender from @USER.',
    priority: 0,
    sourceCode: messageWriteScopeSource(),
  });
  await ensurePreHook({
    name: 'Demo chat message delete RLS',
    routePath: '/chat_message',
    methods: ['DELETE'],
    description: 'Restrict message deletes to conversations containing @USER and snapshot deleted rows.',
    priority: 0,
    sourceCode: messageDeleteSnapshotSource(),
  });
  await ensurePostHook({
    name: 'Demo chat conversation display title',
    routePath: '/chat_conversation',
    methods: ['GET'],
    description: 'Resolve DM conversation titles from the current user perspective.',
    priority: 0,
    sourceCode: conversationTitleResponseSource(),
  });
  await ensurePostHook({
    name: 'Demo chat membership conversation display title',
    routePath: '/chat_conversation_member',
    methods: ['GET'],
    description: 'Resolve deep conversation titles from the current user perspective.',
    priority: 0,
    sourceCode: conversationTitleResponseSource(),
  });
  await ensurePostHook({
    name: 'Demo chat message delete last message repair',
    routePath: '/chat_message',
    methods: ['DELETE'],
    description: 'Repair chat_conversation.lastMessage when deleting the latest message.',
    priority: 0,
    sourceCode: messageDeleteLastMessageRepairSource(),
  });

  const dm = await ensureConversation({
    kind: 'dm',
    title: 'Mai Tran',
    updatedAt: now,
    createdBy: { id: me.id },
  });
  const group = await ensureConversation({
    kind: 'group',
    title: 'Runtime Chat Demo',
    description: 'Socket, flow, and PostgreSQL persistence demo',
    updatedAt: now,
    createdBy: { id: me.id },
  });

  for (const item of [me, users[1]]) {
    await ensureMembership({ conversationId: dm.id, userId: item.id, role: item.id === me.id ? 'owner' : 'member', joinedAt: now });
  }
  for (const item of [me, users[1], users[2], users[3]]) {
    await ensureMembership({ conversationId: group.id, userId: item.id, role: item.id === me.id ? 'owner' : 'member', joinedAt: now });
  }
  const seedDmMessage = await ensureMessage({ text: 'This message is persisted in PostgreSQL through Enfyra.', conversationId: dm.id, senderId: users[1].id });
  const seedGroupMessage = await ensureMessage({ text: 'Persist first, then realtime fanout.', conversationId: group.id, senderId: users[2].id });
  if (seedDmMessage?.id) await updateRecord('chat_conversation', dm.id, { lastMessage: { id: seedDmMessage.id }, updatedAt: seedDmMessage.createdAt || now });
  if (seedGroupMessage?.id) await updateRecord('chat_conversation', group.id, { lastMessage: { id: seedGroupMessage.id }, updatedAt: seedGroupMessage.createdAt || now });
  for (const item of [me, users[1]]) {
    await ensureReadReceipt({
      messageId: seedDmMessage?.id,
      conversationId: dm.id,
      memberId: item.id,
      isRead: item.id === users[1].id,
      readAt: item.id === users[1].id ? now : null,
    });
  }
  for (const item of [me, users[1], users[2], users[3]]) {
    await ensureReadReceipt({
      messageId: seedGroupMessage?.id,
      conversationId: group.id,
      memberId: item.id,
      isRead: item.id === users[2].id,
      readAt: item.id === users[2].id ? now : null,
    });
  }

  const staleFlow = await flowByName('chat_message_persist');
  if (staleFlow?.id) {
    const staleSteps = await query('flow_step_definition', { flow: { id: { _eq: staleFlow.id } } }, { limit: 50 });
    for (const step of staleSteps) {
      await deleteRecord('flow_step_definition', step.id);
    }
    await deleteRecord('flow_definition', staleFlow.id);
  }

  let gateway = await wsByPath('/chat');
  if (!gateway) {
    gateway = await createRecord('websocket_definition', {
      path: '/chat',
      isEnabled: true,
      isSystem: false,
      description: 'Demo chat Socket.IO gateway.',
      requireAuth: true,
      scriptLanguage: 'typescript',
      connectionHandlerTimeout: 5000,
    });
  }

  const events = [
    {
      eventName: 'chat:join',
      sourceCode: `const userId = @USER?.id;
if (!userId) @THROW401('Unauthorized');
const memberships = await @REPOS.chat_conversation_member.find({
  filter: {
    member: { id: { _eq: userId } },
  },
  deep: {},
  fields: 'conversation',
  limit: 500,
});
for (const membership of memberships.data || []) {
  const conversationId = membership.conversation?.id || membership.conversation;
  if (conversationId) {
    @SOCKET.join('conversation:' + conversationId);
  }
}
@SOCKET.reply('chat:joined', { joined: memberships.data?.length || 0 });
`,
    },
    {
      eventName: 'chat:presence',
      sourceCode: `const userId = @USER?.id;
if (!userId) @THROW401('Unauthorized');
const seenAt = new Date().toISOString();
const requestedIds = Array.isArray(@BODY.userIds) ? @BODY.userIds : [];
const uniqueIds = [];
for (const item of requestedIds) {
  if (item && item !== userId && !uniqueIds.includes(item)) {
    uniqueIds.push(item);
  }
}
const users = [];
for (const item of uniqueIds.slice(0, 100)) {
  const sockets = await @SOCKET.roomSize('user_' + item);
  users.push({
    userId: item,
    isOnline: sockets > 0,
    sockets,
    seenAt,
  });
}
@SOCKET.reply('chat:presence:state', {
  users,
  seenAt,
});
`,
      dataShape: [
        { name: 'userIds', type: 'array', required: false },
      ],
    },
    {
      eventName: 'chat:typing',
      sourceCode: `${membershipCheckSource()}
@SOCKET.broadcastToRoom('conversation:' + @BODY.conversationId, 'chat:typing', {
  conversationId: @BODY.conversationId,
  senderId: @USER.id,
  sender: {
    id: @USER.id,
    email: @USER.email,
    displayName: @USER.displayName || @USER.email,
    avatarUrl: @USER.avatarUrl || null,
  },
  isTyping: @BODY.isTyping === true,
});
`,
      dataShape: [
        { name: 'conversationId', type: 'string', required: true },
        { name: 'isTyping', type: 'boolean', required: false },
      ],
    },
    {
      eventName: 'chat:read',
      sourceCode: `${membershipCheckSource()}
const readAt = @BODY.readAt ? new Date(@BODY.readAt).toISOString() : new Date().toISOString();
const membership = await @REPOS.chat_conversation_member.find({
  filter: {
    conversation: { id: { _eq: @BODY.conversationId } },
    member: { id: { _eq: @USER.id } },
  },
  deep: {},
  fields: 'id',
  limit: 1,
});
const unreadRows = await @REPOS.chat_message_read.find({
  filter: {
    conversation: { id: { _eq: @BODY.conversationId } },
    member: { id: { _eq: @USER.id } },
    isRead: { _eq: false },
  },
  deep: {},
  fields: 'id',
  limit: 500,
});
await Promise.all((unreadRows.data || []).map((row) =>
  @REPOS.chat_message_read.update({
    id: row.id,
    data: {
      isRead: true,
      readAt: readAt,
    },
  })
));
const recipients = await @REPOS.chat_conversation_member.find({
  filter: { conversation: { id: { _eq: @BODY.conversationId } } },
  deep: {},
  fields: 'member',
  limit: 50,
});
for (const row of recipients.data || []) {
  const memberId = row.member?.id || row.member;
  if (memberId) {
    @SOCKET.emitToCurrentRoom('user_' + memberId, 'chat:read', {
  conversationId: @BODY.conversationId,
  userId: @USER.id,
  readAt,
});
  }
}
return { ok: true, readAt };
`,
      dataShape: [
        { name: 'conversationId', type: 'string', required: true },
        { name: 'readAt', type: 'string', required: false },
      ],
    },
    {
      eventName: 'chat:message',
      sourceCode: `${membershipCheckSource()}
const text = (@BODY.text || '').trim();
if (!text) @THROW400('text is required');
const createdAt = new Date().toISOString();
const clientMessageId = @BODY.messageId || ('rt_' + createdAt + '_' + @USER.id + '_' + Math.random().toString(36).slice(2));
const targetConversationId = @BODY.conversationId;
const recipients = await @REPOS.chat_conversation_member.find({
  filter: { conversation: { id: { _eq: targetConversationId } } },
  deep: {},
  fields: 'member',
  limit: 50,
});
const recipientIds = Array.from(new Set((recipients.data || [])
  .map((row) => row.member?.id || row.member)
  .filter(Boolean)));
const messageResult = await @REPOS.chat_message.create({
  data: {
    text,
    persistStatus: 'persisted',
    conversation: { id: targetConversationId },
    sender: { id: @USER.id },
  },
});
const persisted = messageResult.data?.[0] || {};
await Promise.all(recipientIds.map((memberId) => {
  const isSender = memberId === @USER.id;
  return @REPOS.chat_message_read.create({
    data: {
      message: { id: persisted.id || clientMessageId },
      conversation: { id: targetConversationId },
      member: { id: memberId },
      isRead: isSender,
      readAt: isSender ? createdAt : null,
    },
  });
}));
const message = {
  id: persisted.id || clientMessageId,
  clientMessageId,
  conversationId: targetConversationId,
  senderId: @USER.id,
  sender: {
    id: @USER.id,
    email: @USER.email,
    displayName: @USER.displayName || @USER.email,
    avatarUrl: @USER.avatarUrl || null,
  },
  text: persisted.text || text,
  createdAt: persisted.createdAt || createdAt,
  status: 'delivered',
};
await @REPOS.chat_conversation.update({
  id: targetConversationId,
  data: {
    lastMessage: { id: message.id },
    updatedAt: message.createdAt,
  },
});
const latestResult = await @REPOS.chat_message.find({
  filter: { conversation: { id: { _eq: targetConversationId } } },
  deep: {},
  fields: 'id,createdAt',
  sort: '-createdAt,-id',
  limit: 1,
});
const latest = latestResult.data?.[0];
if (latest?.id && String(latest.id) !== String(message.id)) {
  await @REPOS.chat_conversation.update({
    id: targetConversationId,
    data: {
      lastMessage: { id: latest.id },
      updatedAt: latest.createdAt || message.createdAt,
    },
  });
}
@SOCKET.broadcastToRoom('conversation:' + message.conversationId, 'chat:message', message);
@SOCKET.reply('chat:message:sent', message);
`,
      dataShape: [
        { name: 'conversationId', type: 'string', required: true },
        { name: 'messageId', type: 'string', required: false },
        { name: 'text', type: 'string', required: true },
      ],
    },
    {
      eventName: 'chat:delete',
      sourceCode: `${membershipCheckSource()}
const conversationResult = await @REPOS.chat_conversation.find({
  filter: { id: { _eq: @BODY.conversationId } },
  deep: {},
  fields: 'id,kind',
  limit: 1,
});
const conversation = conversationResult.data?.[0];
if (!conversation?.id) @THROW404('Conversation not found');
const memberships = await @REPOS.chat_conversation_member.find({
  filter: { conversation: { id: { _eq: @BODY.conversationId } } },
  deep: {},
  fields: 'id,member',
  limit: 50,
});
const targetMemberships = @BODY.scope === 'everyone' && conversation.kind === 'dm'
  ? memberships.data || []
  : (memberships.data || []).filter((membership) => (membership.member?.id || membership.member) === @USER.id);
await Promise.all(targetMemberships.map((membership) =>
  @REPOS.chat_conversation_member.delete({ id: membership.id })
));
const remaining = await @REPOS.chat_conversation_member.find({
  filter: { conversation: { id: { _eq: @BODY.conversationId } } },
  deep: {},
  fields: 'id',
  limit: 1,
});
if (!remaining.data?.length) {
  await @REPOS.chat_conversation.delete({ id: @BODY.conversationId });
}
for (const membership of targetMemberships) {
  const memberId = membership.member?.id || membership.member;
  if (memberId) {
    @SOCKET.emitToUser(memberId, 'chat:deleted', { conversationId: @BODY.conversationId });
  }
}
@SOCKET.reply('chat:deleted:done', { conversationId: @BODY.conversationId });
`,
      dataShape: [
        { name: 'conversationId', type: 'string', required: true },
        { name: 'scope', type: 'string', required: true },
      ],
    },
    {
      eventName: 'chat:new',
      sourceCode: `const ownerId = @USER?.id;
if (!ownerId) @THROW401('Unauthorized');
const kind = @BODY.kind === 'group' ? 'group' : 'dm';
const requestedMemberIds = Array.isArray(@BODY.memberIds) ? @BODY.memberIds.filter(Boolean) : [];
const memberIds = Array.from(new Set([ownerId, ...requestedMemberIds]));
if (kind === 'dm' && memberIds.length !== 2) @THROW400('DM requires one peer');
if (kind === 'group' && memberIds.length < 3) @THROW400('Group requires at least three members');
const text = (@BODY.text || '').trim();
const createdAt = new Date().toISOString();
const usersResult = await @REPOS.user_definition.find({
  filter: { id: { _in: memberIds } },
  deep: {},
  fields: 'id,email,displayName',
  limit: 0,
});
const usersById = new Map((usersResult.data || []).map((user) => [user.id, user]));
const labelFor = (user) => user?.displayName || user?.email || 'Unknown user';
const peerIds = memberIds.filter((memberId) => memberId !== ownerId);
const peerLabels = peerIds.map((memberId) => labelFor(usersById.get(memberId))).filter(Boolean);
const requestedTitle = typeof @BODY.title === 'string' ? @BODY.title.trim() : '';
const title = kind === 'group'
  ? (requestedTitle || peerLabels.join(', ') || 'Group chat')
  : (peerLabels[0] || 'Direct message');
const conversationResult = await @REPOS.chat_conversation.create({
  data: {
    kind,
    title,
    description: null,
    updatedAt: createdAt,
    createdBy: { id: ownerId },
  },
});
const conversation = conversationResult.data?.[0] || {};
const conversationId = conversation.id;
if (!conversationId) @THROW500('Conversation was not created');
await Promise.all(memberIds.map((memberId) =>
  @REPOS.chat_conversation_member.create({
    data: {
      role: memberId === ownerId ? 'owner' : 'member',
      joinedAt: createdAt,
      conversation: { id: conversationId },
      member: { id: memberId },
    },
  })
));
@SOCKET.join('conversation:' + conversationId);
if (text) {
  const clientMessageId = @BODY.messageId || ('rt_' + createdAt + '_' + ownerId + '_' + Math.random().toString(36).slice(2));
  const messageResult = await @REPOS.chat_message.create({
    data: {
      text,
      persistStatus: 'persisted',
      conversation: { id: conversationId },
      sender: { id: ownerId },
    },
  });
  const persisted = messageResult.data?.[0] || {};
  await Promise.all(memberIds.map((memberId) => {
    const isSender = memberId === ownerId;
    return @REPOS.chat_message_read.create({
      data: {
        message: { id: persisted.id || clientMessageId },
        conversation: { id: conversationId },
        member: { id: memberId },
        isRead: isSender,
        readAt: isSender ? createdAt : null,
      },
    });
  }));
  const message = {
    id: persisted.id || clientMessageId,
    clientMessageId,
    conversationId,
    senderId: ownerId,
    sender: {
      id: ownerId,
      email: @USER.email,
      displayName: @USER.displayName || @USER.email,
      avatarUrl: @USER.avatarUrl || null,
    },
    text: persisted.text || text,
    createdAt: persisted.createdAt || createdAt,
    status: 'delivered',
  };
  await @REPOS.chat_conversation.update({
    id: conversationId,
    data: {
      lastMessage: { id: message.id },
      updatedAt: message.createdAt,
    },
  });
  @SOCKET.reply('chat:message:sent', message);
}
const payload = { requestId: @BODY.requestId, conversationId, kind };
@SOCKET.reply('chat:new', payload);
for (const memberId of memberIds) {
  if (memberId !== ownerId) {
    @SOCKET.emitToUser(memberId, 'chat:new', payload);
  }
}
`,
      dataShape: [
        { name: 'kind', type: 'string', required: true },
        { name: 'memberIds', type: 'array', required: true },
        { name: 'messageId', type: 'string', required: false },
        { name: 'requestId', type: 'string', required: false },
        { name: 'text', type: 'string', required: false },
      ],
    },
  ];

  for (const event of events) {
    const existing = await eventByName(gateway.id, event.eventName);
    const eventData = {
      gateway: { id: gateway.id },
      eventName: event.eventName,
      isEnabled: true,
      isSystem: false,
      description: `Demo chat event ${event.eventName}.`,
      sourceCode: event.sourceCode,
      scriptLanguage: 'typescript',
      timeout: 10000,
    };
    if (existing) {
      await updateRecord('websocket_event_definition', existing.id, eventData);
    } else {
      await createRecord('websocket_event_definition', eventData);
    }
  }
  const stalePresenceBroadcast = await eventByName(gateway.id, 'chat:presence:broadcast');
  if (stalePresenceBroadcast?.id) {
    await deleteRecord('websocket_event_definition', stalePresenceBroadcast.id);
  }

  await client.close();

  process.stdout.write(JSON.stringify({
    ok: true,
    apiUrl,
    tables: {
      chat_conversation: conversation.id,
      chat_conversation_member: member.id,
      chat_message: message.id,
      chat_message_read: readReceipt.id,
    },
    flow: null,
    gateway: gateway.id,
  }, null, 2));
};

setup().catch(async (error) => {
  try {
    await client.close();
  } catch {}
  console.error(error);
  process.exit(1);
});
