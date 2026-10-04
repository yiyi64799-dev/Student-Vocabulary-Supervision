import test from 'node:test';
import assert from 'node:assert/strict';
import { assignRanks, calculateScore, getSubmissionTiming, normalizeAnswer, parseWordImport, shuffle } from '../.test-dist/core.mjs';
import { validateTaskWords } from '../.test-dist/validators.mjs';

test('normalize 仅忽略首尾空格和英文大小写', () => {
  assert.equal(normalizeAnswer('  Apple  '), 'apple');
  assert.notEqual(normalizeAnswer('ice cream'), normalizeAnswer('icecream'));
  assert.notEqual(normalizeAnswer("mother-in-law"), normalizeAnswer('mother in law'));
});

test('评分按正确数比例四舍五入', () => {
  assert.equal(calculateScore(2, 3), 67);
  assert.equal(calculateScore(0, 0), 0);
});

test('截止后仍正常区分逾期', () => {
  const deadline = new Date('2026-01-01T00:00:00Z');
  assert.equal(getSubmissionTiming(new Date('2025-12-31T23:59:59Z'), deadline), 'on_time');
  assert.equal(getSubmissionTiming(new Date('2026-01-01T00:00:01Z'), deadline), 'overdue');
});

test('粘贴导入支持 TAB、竖线和逗号并去重', () => {
  const result = parseWordImport('apple\t苹果\nbanana | 香蕉\nschool,学校\nAPPLE\t重复\nbadonly');
  assert.equal(result.validCount, 3);
  assert.equal(result.duplicateCount, 1);
  assert.equal(result.errorCount, 1);
  assert.deepEqual(result.validRows.map((row) => row.word), ['apple', 'banana', 'school']);
});

test('200 行粘贴文本可完整解析', () => {
  const text = Array.from({ length: 200 }, (_, index) => `word${index}\t释义${index}`).join('\n');
  const result = parseWordImport(text);
  assert.equal(result.validCount, 200);
  assert.equal(result.errorCount, 0);
});

test('任务允许 200 词并拒绝第 201 词', () => {
  const words = Array.from({ length: 200 }, (_, index) => ({ word: `word${index}`, meaning: `释义${index}` }));
  assert.equal(validateTaskWords(words).errors.length, 0);
  assert.match(validateTaskWords([...words, { word: 'overflow', meaning: '超限' }]).errors[0], /200/);
});

test('排名按分数降序、提交时间升序，完全相同则并列', () => {
  const rows = assignRanks([
    { userId: 'b', nickname: 'B', avatarUrl: '', score: 90, submittedAt: '2026-01-01T10:00:00Z', timing: 'on_time' },
    { userId: 'a', nickname: 'A', avatarUrl: '', score: 100, submittedAt: '2026-01-01T11:00:00Z', timing: 'on_time' },
    { userId: 'c', nickname: 'C', avatarUrl: '', score: 90, submittedAt: '2026-01-01T10:00:00Z', timing: 'overdue' },
  ]);
  assert.deepEqual(rows.map((row) => [row.userId, row.rank]), [['a', 1], ['b', 2], ['c', 2]]);
});

test('固定随机源的洗牌可复现且不修改原数组', () => {
  const source = ['a', 'b', 'c'];
  assert.deepEqual(shuffle(source, () => 0), ['b', 'c', 'a']);
  assert.deepEqual(source, ['a', 'b', 'c']);
});
