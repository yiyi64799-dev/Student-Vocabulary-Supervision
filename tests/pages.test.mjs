import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { build } from 'esbuild';

async function loadPage(name, api, user = { nickname: '同学', accountRole: 'student' }) {
  const { outputFiles } = await build({
    entryPoints: ['miniprogram/pages/' + name + '/index.ts'],
    bundle: true, write: false, platform: 'node', format: 'cjs',
    plugins: [{
      name: 'mock-api',
      setup(builder) {
        builder.onResolve({ filter: /services\/api$/ }, () => ({ path: 'api', namespace: 'test' }));
        builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const api = globalThis.testApi;', loader: 'js' }));
      },
    }],
  });
  const navigation = [];
  let page;
  vm.runInNewContext(outputFiles[0].text, {
    testApi: api,
    Page: (definition) => { page = definition; },
    getApp: () => ({ globalData: { ready: Promise.resolve(), user } }),
    wx: { showToast() {}, setNavigationBarTitle() {}, navigateTo: (options) => navigation.push(options.url), redirectTo: (options) => navigation.push(options.url) },
    console,
  });
  page.setData = (data) => Object.assign(page.data, data);
  return { page, navigation };
}

const task = (id) => ({ _id: id, title: 'Unit ' + id, status: 'published', wordCount: 10, deadline: '2027-01-01T12:00:00Z' });

test('教师账号登录自动进入教学工作台，学生不能通过页面地址进入教师端', async () => {
  const teacher = { nickname: '老师', accountRole: 'teacher' };
  const home = await loadPage('home', {}, teacher);
  await home.page.load();
  assert.equal(home.navigation[0], '/pages/teacher/index');
  const student = await loadPage('teacher', { auth: { ensureUser: async () => ({ accountRole: 'student' }) } });
  await student.page.load();
  assert.equal(student.navigation[0], '/pages/home/index');
});

test('教学工作台仅显示自己管理的小组；预览只列已发布任务并进入独立页面', async () => {
  const { page, navigation } = await loadPage('teacher', {
    auth: { ensureUser: async () => ({ nickname: '老师', accountRole: 'teacher' }) },
    group: { listMine: async () => [{ _id: 'g', role: 'owner', name: '一班' }, { _id: 'other', role: 'member' }] },
    task: { listByGroup: async (id) => { assert.equal(id, 'g'); return [task('p'), { ...task('d'), status: 'draft' }, { ...task('w'), status: 'withdrawn' }]; } },
  });
  await page.load();
  assert.equal(page.data.groups.length, 1);
  assert.equal(page.data.previewTasks.length, 1);
  page.openTask({ currentTarget: { dataset: { id: 'd' } } });
  assert.equal(navigation.pop(), '/pages/task-edit/index?taskId=d');
  page.togglePreview();
  page.openTask({ currentTarget: { dataset: { id: 'p' } } });
  assert.equal(navigation.pop(), '/pages/student-preview/index?taskId=p');
});

test('学生预览完整体验只读 API：记忆、默写、错词练习均不调用正式写接口', async () => {
  let reads = 0;
  const words = [{ _id: 'a', word: 'Apple', meaning: '苹果' }, { _id: 'b', word: 'ice-cream', meaning: '冰淇淋' }];
  const { page } = await loadPage('student-preview', { task: { previewStudent: async () => { reads++; return { title: '词卡', words }; } } });
  await page.load();
  page.startDictation();
  assert.equal(page.data.phase, 'memory');
  page.next();
  page.startDictation();
  assert.equal(page.data.phase, 'dictation');
  for (let i = 0; i < 2; i++) {
    page.onAnswer({ detail: { value: page.data.current._id === 'a' ? ' APPLE ' : 'ice cream' } });
    if (i === 0) page.next();
  }
  page.submit();
  assert.equal(page.data.score, 50);
  assert.equal(page.data.items.filter((item) => !item.correct).length, 1);
  page.practiceWrong();
  assert.equal(page.data.words.length, 1);
  page.onAnswer({ detail: { value: 'ice-cream' } });
  page.submit();
  assert.equal(page.data.score, 100);
  assert.equal(reads, 1);
  await page.load();
  assert.equal(Object.keys(page.data.answers).length, 0);
  assert.equal(page.data.phase, 'memory');
});

test('首页保留成功小组数据，部分失败不阻断其他任务；错词分栏只展示正式错词', async () => {
  const { page } = await loadPage('home', {
    group: { listMine: async () => [{ _id: 'a', role: 'member', name: '一班' }, { _id: 'b', role: 'member', name: '二班' }, { _id: 'owner', role: 'owner' }] },
    task: {
      listByGroup: async (id) => { assert.notEqual(id, 'owner'); if (id === 'b') throw new Error('offline'); return [task('1'), task('2')]; },
      getMemberView: async (id) => ({ progress: id === '1' ? { stage: 'learning', studyIndex: 3 } : { stage: 'submitted', totalCount: 10, correctCount: 8 } }),
    },
  });
  await page.load();
  assert.equal(page.data.state, 'ready');
  assert.equal(page.data.groups.length, 3);
  assert.equal(page.data.tasksError, true);
  assert.equal(page.data.pendingCount, 1);
  assert.equal(page.data.reviewCount, 1);
  assert.equal(page.data.visibleTasks[0].progressPercent, 40);
  page.selectTab({ currentTarget: { dataset: { key: 'review' } } });
  assert.equal(page.data.visibleTasks.length, 1);
  assert.equal(page.data.visibleTasks[0]._id, '2');
});

test('任务筛选后的点击通过 ID 找到正确任务，Member 不显示草稿筛选', async () => {
  const { page, navigation } = await loadPage('group-detail', {
    group: { getDetail: async () => ({ name: '一班', myRole: 'member' }) },
    task: { listByGroup: async () => [task('1'), task('2')] },
  });
  await page.load();
  page.onSearch({ detail: { value: 'unit 2' } });
  assert.equal(page.data.visibleTasks.length, 1);
  assert.equal(page.data.filters.some((item) => item.key === 'draft'), false);
  page.openTask({ currentTarget: { dataset: { id: '2' } } });
  assert.equal(navigation[0], '/pages/member-task-detail/index?taskId=2');
});

test('只看错词不修改正式分数和原逐题答案', async () => {
  const { page } = await loadPage('result', { attempt: { getResult: async () => ({
    submission: { score: 50, correctCount: 1, totalCount: 2, submittedAt: '2026-09-20T01:00:00Z' },
    items: [{ wordId: '1', isCorrect: true }, { wordId: '2', isCorrect: false }],
  }) } });
  await page.load();
  page.toggleWrong();
  assert.equal(page.data.visibleItems.length, 1);
  assert.equal(page.data.visibleItems[0].wordId, '2');
  assert.equal(page.data.submission.score, 50);
  assert.equal(page.data.items.length, 2);
  page.toggleWrong();
  assert.equal(page.data.visibleItems.length, 2);
});
