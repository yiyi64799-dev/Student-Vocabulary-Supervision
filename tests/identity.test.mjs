import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const userId = (openid) => hash('user:' + openid).slice(0, 48);
const code = 'A'.repeat(32);
const { outputFiles } = await build({
  entryPoints: ['cloudfunctions/_shared/domain.ts'], bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{ name: 'mock-cloud', setup(builder) {
    builder.onResolve({ filter: /^wx-server-sdk$/ }, () => ({ path: 'cloud', namespace: 'mock' }));
    builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export default globalThis.testCloud;' }));
  } }],
});

function setup() {
  const data = new Map();
  const writes = [];
  let openid = 'student';
  let queue = Promise.resolve();
  function collection(name) {
    const query = (filter = {}) => ({
      where: (value) => query(value), limit() { return this; }, orderBy() { return this; },
      get: async () => ({ data: [...data.entries()].filter(([key, value]) => key.startsWith(name + '/') && Object.entries(filter).every(([k, v]) => value[k] === v)).map(([, value]) => structuredClone(value)) }),
      doc(id) {
        const key = name + '/' + id;
        return {
          get: async () => ({ data: data.has(key) ? structuredClone(data.get(key)) : null }),
          set: async ({ data: value }) => { data.set(key, { ...structuredClone(value), _id: id }); writes.push(key); },
          update: async ({ data: value }) => { assert.ok(data.has(key)); data.set(key, { ...data.get(key), ...structuredClone(value) }); writes.push(key); },
        };
      },
    });
    return query();
  }
  const db = { collection, command: { inc: (n) => n }, runTransaction(fn) {
    const pending = queue.then(async () => {
      const snapshot = structuredClone(data);
      try { return await fn({ collection }); }
      catch (error) { data.clear(); for (const [k, v] of snapshot) data.set(k, v); throw error; }
    });
    queue = pending.catch(() => {});
    return pending;
  } };
  const module = { exports: {} };
  vm.runInNewContext(outputFiles[0].text, { module, exports: module.exports, require: createRequire(import.meta.url), console, testCloud: { init() {}, database: () => db, getWXContext: () => ({ OPENID: openid }) } });
  return { handlers: module.exports, data, writes, as: (id) => { openid = id; },
    user(id, role = 'student') { data.set('users/' + userId(id), { _id: userId(id), openid: id, nickname: id, accountRole: role }); },
    activation(status = 'active', expiresAt = new Date(Date.now() + 3600000)) { data.set('teacher_activation_codes/' + hash(code), { _id: hash(code), status, expiresAt }); },
  };
}

test('默认学生；初始化和资料更新不接受客户端身份字段', async () => {
  const s = setup();
  const user = await s.handlers.authHandlers.ensureUser({ accountRole: 'teacher', role: 'owner' });
  assert.equal(user.accountRole, 'student');
  s.activation();
  await Promise.all([s.handlers.authHandlers.activateTeacher({ code }), s.handlers.authHandlers.ensureUser({})]);
  assert.equal(s.data.get('users/' + userId('student')).accountRole, 'teacher');
  const saved = await s.handlers.authHandlers.updateProfile({ nickname: '新昵称', accountRole: 'student' });
  assert.equal(saved.accountRole, 'teacher');
  assert.equal(saved.openid, undefined);
});

test('学生不能创建小组，伪造 ownerId 和 accountRole 也不能提权', async () => {
  const s = setup(); s.user('student');
  await assert.rejects(s.handlers.groupHandlers.create({ name: '英语组', accountRole: 'teacher', ownerId: 'teacher' }), { code: 'TEACHER_REQUIRED' });
  assert.equal(s.writes.length, 0);
});

test('教师开通码一次性兑换，重复请求幂等，其他账号不可复用', async () => {
  const s = setup(); s.user('student'); s.activation();
  const results = await Promise.all([s.handlers.authHandlers.activateTeacher({ code }), s.handlers.authHandlers.activateTeacher({ code })]);
  assert.ok(results.every((result) => result.accountRole === 'teacher'));
  assert.equal(s.data.get('teacher_activation_codes/' + hash(code)).status, 'used');
  s.as('other'); s.user('other');
  await assert.rejects(s.handlers.authHandlers.activateTeacher({ code }), { code: 'INVALID_TEACHER_CODE' });
  assert.equal(s.data.get('users/' + userId('other')).accountRole, 'student');
});

test('无效、作废和过期码拒绝开通，失败次数落库并限流', async () => {
  for (const status of ['missing', 'revoked', 'expired']) {
    const s = setup(); s.user('student');
    if (status !== 'missing') s.activation(status === 'expired' ? 'active' : status, new Date(status === 'expired' ? 0 : Date.now() + 10000));
    for (let i = 0; i < 5; i++) await assert.rejects(s.handlers.authHandlers.activateTeacher({ code }), { code: 'INVALID_TEACHER_CODE' });
    await assert.rejects(s.handlers.authHandlers.activateTeacher({ code }), { code: 'ACTIVATION_RATE_LIMITED' });
    const user = s.data.get('users/' + userId('student'));
    assert.equal(user.activationAttempts, 5);
    user.activationWindowAt = new Date(Date.now() - 16 * 60 * 1000);
    s.activation();
    assert.equal((await s.handlers.authHandlers.activateTeacher({ code })).accountRole, 'teacher');
  }
});

test('成员读取使用与入组写入一致的确定性 ID', async () => {
  const s = setup(); s.user('student');
  s.data.set('groups/g', { _id: 'g', name: '小组', ownerId: 'owner', memberCount: 1 });
  const id = hash('g:' + userId('student')).slice(0, 48);
  s.data.set('group_members/' + id, { groupId: 'g', userId: userId('student'), role: 'member', status: 'active' });
  assert.equal((await s.handlers.groupHandlers.getDetail({ groupId: 'g' })).myRole, 'member');
});

test('预览仅限本组教师 Owner，200 词只读，不写任何成绩或进度', async () => {
  const s = setup(); s.user('student', 'teacher');
  s.data.set('groups/g', { _id: 'g', ownerId: userId('student') });
  const task = { _id: 't', groupId: 'g', status: 'published', wordCount: 200, snapshotVersion: 'v1', title: '测试' };
  s.data.set('tasks/t', task);
  for (let i = 0; i < 200; i++) s.data.set('task_words/' + i, { _id: String(i), taskId: 't', snapshotVersion: 'v1', word: 'word' + i, meaning: '词', index: i });
  assert.equal((await s.handlers.taskHandlers.previewStudent({ taskId: 't' })).words.length, 200);
  assert.equal(s.writes.length, 0);
  s.as('other'); s.user('other', 'teacher');
  await assert.rejects(s.handlers.taskHandlers.previewStudent({ taskId: 't', ownerId: userId('student') }), { code: 'FORBIDDEN' });
  s.as('student'); s.user('student');
  await assert.rejects(s.handlers.taskHandlers.previewStudent({ taskId: 't' }), { code: 'TEACHER_REQUIRED' });
  s.user('student', 'teacher'); task.status = 'withdrawn';
  await assert.rejects(s.handlers.taskHandlers.previewStudent({ taskId: 't' }), { code: 'TASK_WITHDRAWN' });
  task.status = 'draft';
  await assert.rejects(s.handlers.taskHandlers.previewStudent({ taskId: 't' }), { code: 'TASK_NOT_PUBLISHED' });
  assert.equal(s.writes.length, 0);
});
