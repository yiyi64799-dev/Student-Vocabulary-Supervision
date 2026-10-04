import { activateTeacher } from './teacher';
import { COLLECTIONS, ERROR_CODES, LIMITS } from '../../shared/constants';
import { assignRanks, calculateScore, getSubmissionTiming, normalizeAnswer, parseWordImport, shuffle } from '../../shared/core';
import type { RankingEntry } from '../../shared/types';
import { validateGroupInput, validateTaskWords } from '../../shared/validators';
import { BusinessError, command, db, ensureUser, getMembership, getTask, parseDate, requireMember, requireOwner, requireString, safeUser, toPlainDate } from './runtime';
import { generateInviteCode, relationId, stableHash } from './ids';

type Doc = Record<string, any>;
type Transaction = { collection: (name: string) => any };

const userIdOf = (user: Doc): string => String(user._id);
const cleanTask = (task: Doc) => ({ ...task, draftWords: task.status === 'draft' ? task.draftWords ?? [] : undefined });

const runInBatches = async <T>(items: readonly T[], size: number, worker: (item: T, index: number) => Promise<unknown>): Promise<void> => {
  for (let offset = 0; offset < items.length; offset += size) {
    const batch = items.slice(offset, offset + size);
    await Promise.all(batch.map((item, index) => worker(item, offset + index)));
  }
};

export const authHandlers = {
  activateTeacher,
  async ensureUser(payload: Doc) {
    const user = await ensureUser();
    const nickname = typeof payload.nickname === 'string' ? payload.nickname.trim().slice(0, 30) : '';
    const avatarUrl = typeof payload.avatarUrl === 'string' ? payload.avatarUrl.trim().slice(0, 500) : '';
    if (nickname || avatarUrl) {
      await db.collection(COLLECTIONS.users).doc(String(user._id)).update({ data: { ...(nickname ? { nickname } : {}), ...(avatarUrl ? { avatarUrl } : {}), updatedAt: new Date() } });
      return safeUser({ ...user, ...(nickname ? { nickname } : {}), ...(avatarUrl ? { avatarUrl } : {}), updatedAt: new Date() });
    }
    return safeUser(user);
  },
  async updateProfile(payload: Doc) {
    const user = await ensureUser();
    const nickname = requireString(payload.nickname, '昵称').slice(0, 30);
    const avatarUrl = typeof payload.avatarUrl === 'string' ? payload.avatarUrl.trim().slice(0, 500) : '';
    const updatedAt = new Date();
    await db.collection(COLLECTIONS.users).doc(userIdOf(user)).update({ data: { nickname, avatarUrl, updatedAt } });
    return safeUser({ ...user, nickname, avatarUrl, updatedAt });
  },
};

const uniqueInviteCode = async (): Promise<string> => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateInviteCode();
    const match = await db.collection(COLLECTIONS.groups).where({ inviteCode: code }).limit(1).get();
    if (match.data.length === 0) return code;
  }
  throw new BusinessError(ERROR_CODES.INTERNAL_ERROR, '邀请码生成失败，请重试');
};

export const groupHandlers = {
  async create(payload: Doc) {
    const user = await ensureUser();
    if (user.accountRole !== 'teacher') throw new BusinessError(ERROR_CODES.TEACHER_REQUIRED, '请先在个人资料中开通教师身份');
    const name = typeof payload.name === 'string' ? payload.name.trim() : '';
    const description = typeof payload.description === 'string' ? payload.description.trim() : '';
    const errors = validateGroupInput(name, description);
    if (errors.length) throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, errors[0] as string, { errors });
    const idempotencyKey = requireString(payload.idempotencyKey, '幂等键').slice(0, 100);
    const groupId = relationId('group-create', userIdOf(user), idempotencyKey);
    const existing = await db.collection(COLLECTIONS.groups).doc(groupId).get().catch(() => null);
    if (existing?.data) {
      const group = existing.data as Doc;
      if (group.ownerId !== userIdOf(user)) throw new BusinessError(ERROR_CODES.FORBIDDEN, '幂等键冲突');
      return { groupId, inviteCode: group.inviteCode, idempotent: true };
    }
    const inviteCode = await uniqueInviteCode();
    return db.runTransaction(async (transaction: Transaction) => {
      const now = new Date();
      const locked = await transaction.collection(COLLECTIONS.groups).doc(groupId).get().catch(() => null);
      if (locked?.data) {
        const group = locked.data as Doc;
        return { groupId, inviteCode: group.inviteCode, idempotent: true };
      }
      await transaction.collection(COLLECTIONS.groups).doc(groupId).set({ data: { name, description, ownerId: userIdOf(user), inviteCode, inviteVersion: 1, memberCount: 0, createdAt: now, updatedAt: now } });
      const membershipId = relationId(groupId, userIdOf(user));
      await transaction.collection(COLLECTIONS.groupMembers).doc(membershipId).set({ data: { groupId, userId: userIdOf(user), role: 'owner', status: 'active', joinedAt: now, updatedAt: now } });
      return { groupId, inviteCode, idempotent: false };
    });
  },
  async joinByCode(payload: Doc) {
    const user = await ensureUser();
    const inviteCode = requireString(payload.inviteCode, '邀请码').toUpperCase();
    const groups = await db.collection(COLLECTIONS.groups).where({ inviteCode }).limit(1).get();
    const group = groups.data[0] as Doc | undefined;
    if (!group) throw new BusinessError(ERROR_CODES.INVALID_INVITE_CODE, '邀请码无效或已失效');
    if (group.ownerId === userIdOf(user)) throw new BusinessError(ERROR_CODES.ALREADY_IN_GROUP, '你已是该小组的 Owner');
    const membershipId = relationId(String(group._id), userIdOf(user));
    const existing = await db.collection(COLLECTIONS.groupMembers).doc(membershipId).get().catch(() => null);
    if (existing?.data && (existing.data as Doc).status === 'active') throw new BusinessError(ERROR_CODES.ALREADY_IN_GROUP, '你已在该小组中');
    await db.runTransaction(async (transaction: Transaction) => {
      const now = new Date();
      const current = await transaction.collection(COLLECTIONS.groupMembers).doc(membershipId).get().catch(() => null);
      if (current?.data && (current.data as Doc).status === 'active') throw new BusinessError(ERROR_CODES.ALREADY_IN_GROUP, '你已在该小组中');
      await transaction.collection(COLLECTIONS.groupMembers).doc(membershipId).set({ data: { groupId: group._id, userId: userIdOf(user), role: 'member', status: 'active', joinedAt: now, updatedAt: now } });
      await transaction.collection(COLLECTIONS.groups).doc(String(group._id)).update({ data: { memberCount: command.inc(1), updatedAt: now } });
    });
    return { groupId: group._id, joined: true };
  },
  async listMine() {
    const user = await ensureUser();
    const memberships = await db.collection(COLLECTIONS.groupMembers).where({ userId: userIdOf(user), status: 'active' }).limit(100).get();
    const groups = await Promise.all(memberships.data.map(async (membership: Doc) => {
      const result = await db.collection(COLLECTIONS.groups).doc(String(membership.groupId)).get().catch(() => null);
      const group = result?.data as Doc | undefined;
      return group ? { _id: group._id, name: group.name, description: group.description, memberCount: group.memberCount, role: membership.role, inviteCode: membership.role === 'owner' ? group.inviteCode : undefined } : null;
    }));
    return groups.filter(Boolean);
  },
  async getDetail(payload: Doc) {
    const user = await ensureUser();
    const groupId = requireString(payload.groupId, '小组 ID');
    const membership = await getMembership(groupId, userIdOf(user));
    const result = await db.collection(COLLECTIONS.groups).doc(groupId).get().catch(() => null);
    const group = result?.data as Doc | undefined;
    if (!group) throw new BusinessError(ERROR_CODES.GROUP_NOT_FOUND, '小组不存在');
    return { _id: group._id, name: group.name, description: group.description, memberCount: group.memberCount, myRole: membership.role, inviteCode: membership.role === 'owner' ? group.inviteCode : undefined };
  },
  async listMembers(payload: Doc) {
    const user = await ensureUser();
    const groupId = requireString(payload.groupId, '小组 ID');
    await getMembership(groupId, userIdOf(user));
    const members = await db.collection(COLLECTIONS.groupMembers).where({ groupId, status: 'active' }).limit(100).get();
    return Promise.all(members.data.map(async (membership: Doc) => {
      const result = await db.collection(COLLECTIONS.users).doc(String(membership.userId)).get().catch(() => null);
      const profile = result?.data as Doc | undefined;
      return { userId: membership.userId, role: membership.role, joinedAt: membership.joinedAt, nickname: profile?.nickname ?? '微信用户', avatarUrl: profile?.avatarUrl ?? '' };
    }));
  },
  async regenerateInvite(payload: Doc) {
    const user = await ensureUser();
    const groupId = requireString(payload.groupId, '小组 ID');
    const group = await requireOwner(groupId, userIdOf(user));
    const inviteCode = await uniqueInviteCode();
    await db.collection(COLLECTIONS.groups).doc(groupId).update({ data: { inviteCode, inviteVersion: Number(group.inviteVersion ?? 1) + 1, updatedAt: new Date() } });
    return { inviteCode };
  },
};

export const taskHandlers = {
  async previewStudent(payload: Doc) {
    const user = await ensureUser();
    const taskId = requireString(payload.taskId, '任务 ID');
    const task = await getTask(taskId);
    await requireOwner(String(task.groupId), userIdOf(user));
    if (user.accountRole !== 'teacher') throw new BusinessError(ERROR_CODES.TEACHER_REQUIRED, '请先开通教师身份');
    if (task.status !== 'published') throw new BusinessError(task.status === 'withdrawn' ? ERROR_CODES.TASK_WITHDRAWN : ERROR_CODES.TASK_NOT_PUBLISHED, '仅已发布且未撤回的任务可以预览');
    const result = await db.collection(COLLECTIONS.taskWords).where({ taskId, snapshotVersion: task.snapshotVersion }).orderBy('index', 'asc').limit(LIMITS.maxWordsPerTask).get();
    if (result.data.length !== task.wordCount) throw new BusinessError(ERROR_CODES.INTERNAL_ERROR, '词表不完整，请稍后重试');
    return { title: task.title, words: result.data };
  },
  async getOwnerView(payload: Doc) {
    const user = await ensureUser();
    const taskId = requireString(payload.taskId, '任务 ID');
    const task = await getTask(taskId);
    await requireOwner(String(task.groupId), userIdOf(user));
    return cleanTask(task);
  },
  async createDraft(payload: Doc) {
    const user = await ensureUser();
    const groupId = requireString(payload.groupId, '小组 ID');
    await requireOwner(groupId, userIdOf(user));
    const title = typeof payload.title === 'string' && payload.title.trim() ? payload.title.trim().slice(0, 40) : '未命名任务';
    const idempotencyKey = requireString(payload.idempotencyKey, '幂等键').slice(0, 100);
    const taskId = relationId('task-create', userIdOf(user), idempotencyKey);
    return db.runTransaction(async (transaction: Transaction) => {
      const existing = await transaction.collection(COLLECTIONS.tasks).doc(taskId).get().catch(() => null);
      if (existing?.data) {
        const task = existing.data as Doc;
        if (task.ownerId !== userIdOf(user) || task.groupId !== groupId) throw new BusinessError(ERROR_CODES.FORBIDDEN, '幂等键冲突');
        return { taskId, idempotent: true };
      }
      const now = new Date();
      await transaction.collection(COLLECTIONS.tasks).doc(taskId).set({ data: { groupId, ownerId: userIdOf(user), title, deadline: null, status: 'draft', wordCount: 0, draftWords: [], publishedAt: null, withdrawnAt: null, createdAt: now, updatedAt: now } });
      return { taskId, idempotent: false };
    });
  },
  async updateDraft(payload: Doc) {
    const user = await ensureUser();
    const taskId = requireString(payload.taskId, '任务 ID');
    const task = await getTask(taskId);
    await requireOwner(String(task.groupId), userIdOf(user));
    if (task.status !== 'draft') throw new BusinessError(ERROR_CODES.FORBIDDEN, '已发布任务不可编辑');
    const title = requireString(payload.title, '任务标题');
    if (title.length < 2 || title.length > 40) throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, '任务标题需为 2-40 个字符');
    const { words, errors } = validateTaskWords(payload.words ?? []);
    if (errors.length && Array.isArray(payload.words) && payload.words.length > 0) throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, errors[0] as string, { errors });
    const deadline = payload.deadline ? parseDate(payload.deadline, '截止时间') : null;
    await db.collection(COLLECTIONS.tasks).doc(taskId).update({ data: { title, deadline, draftWords: words, wordCount: words.length, updatedAt: new Date() } });
    return { taskId, wordCount: words.length };
  },
  async importPreview(payload: Doc) {
    const user = await ensureUser();
    const taskId = requireString(payload.taskId, '任务 ID');
    const task = await getTask(taskId);
    await requireOwner(String(task.groupId), userIdOf(user));
    if (task.status !== 'draft') throw new BusinessError(ERROR_CODES.FORBIDDEN, '只有草稿任务可以导入单词');
    const text = requireString(payload.text, '粘贴文本');
    if (/\.xlsx\s*$/i.test(text.trim())) throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, 'V1 不支持上传或解析 .xlsx，请从 Excel/WPS 复制两列后粘贴');
    return parseWordImport(text, { wordMax: LIMITS.wordMax, meaningMax: LIMITS.meaningMax });
  },
  async publish(payload: Doc) {
    const user = await ensureUser();
    const taskId = requireString(payload.taskId, '任务 ID');
    const task = await getTask(taskId);
    await requireOwner(String(task.groupId), userIdOf(user));
    if (task.status === 'published') return { taskId, published: true, idempotent: true };
    if (task.status === 'withdrawn') throw new BusinessError(ERROR_CODES.TASK_WITHDRAWN, '已撤回任务不能重新发布，请复制为新任务');
    const { words, errors } = validateTaskWords(task.draftWords);
    if (errors.length) throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, errors[0] as string, { errors });
    const deadline = task.deadline ? toPlainDate(task.deadline) : null;
    if (!deadline || deadline.getTime() <= Date.now()) throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, '发布时间前必须设置晚于当前时间的截止时间');
    const snapshotVersion = stableHash(words);
    const now = new Date();
    await runInBatches(words, 20, async (word, index) => {
      await db.collection(COLLECTIONS.taskWords).doc(relationId(taskId, snapshotVersion, String(index))).set({ data: { taskId, snapshotVersion, index, ...word, normalizedWord: normalizeAnswer(word.word), createdAt: now } });
    });
    await db.runTransaction(async (transaction: Transaction) => {
      const locked = await transaction.collection(COLLECTIONS.tasks).doc(taskId).get();
      const current = locked.data as Doc;
      if (current.status === 'published') return;
      if (current.status !== 'draft') throw new BusinessError(ERROR_CODES.TASK_WITHDRAWN, '任务状态不允许发布');
      if (stableHash(current.draftWords) !== snapshotVersion) throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, '草稿在发布过程中发生变化，请重新发布');
      await transaction.collection(COLLECTIONS.tasks).doc(taskId).update({ data: { status: 'published', snapshotVersion, wordCount: words.length, draftWords: command.remove(), publishedAt: now, updatedAt: now } });
    });
    return { taskId, published: true, idempotent: false };
  },
  async withdraw(payload: Doc) {
    const user = await ensureUser();
    const taskId = requireString(payload.taskId, '任务 ID');
    const task = await getTask(taskId);
    await requireOwner(String(task.groupId), userIdOf(user));
    if (task.status === 'withdrawn') return { taskId, withdrawn: true, idempotent: true };
    if (task.status !== 'published') throw new BusinessError(ERROR_CODES.TASK_NOT_PUBLISHED, '只有已发布任务可以撤回');
    await db.collection(COLLECTIONS.tasks).doc(taskId).update({ data: { status: 'withdrawn', withdrawnAt: new Date(), updatedAt: new Date() } });
    return { taskId, withdrawn: true, idempotent: false };
  },
  async listByGroup(payload: Doc) {
    const user = await ensureUser();
    const groupId = requireString(payload.groupId, '小组 ID');
    const membership = await getMembership(groupId, userIdOf(user));
    const statuses = membership.role === 'owner' ? ['draft', 'published', 'withdrawn'] : ['published', 'withdrawn'];
    const result = await db.collection(COLLECTIONS.tasks).where({ groupId, status: command.in(statuses) }).orderBy('deadline', 'asc').limit(LIMITS.pageSize).get();
    return result.data.map((task: Doc) => cleanTask(task));
  },
  async getMemberView(payload: Doc) {
    const user = await ensureUser();
    const taskId = requireString(payload.taskId, '任务 ID');
    const task = await getTask(taskId);
    await requireMember(String(task.groupId), userIdOf(user));
    if (task.status === 'draft') throw new BusinessError(ERROR_CODES.TASK_NOT_PUBLISHED, '任务尚未发布');
    const progressId = relationId(taskId, userIdOf(user));
    const progress = await db.collection(COLLECTIONS.progress).doc(progressId).get().catch(() => null);
    return { task: cleanTask(task), progress: progress?.data ?? null };
  },
};

export const studyHandlers = {
  async startOrResume(payload: Doc) {
    const user = await ensureUser();
    const taskId = requireString(payload.taskId, '任务 ID');
    const task = await getTask(taskId);
    if (task.status === 'withdrawn') throw new BusinessError(ERROR_CODES.TASK_WITHDRAWN, '任务已撤回');
    if (task.status !== 'published') throw new BusinessError(ERROR_CODES.TASK_NOT_PUBLISHED, '任务尚未发布');
    await requireMember(String(task.groupId), userIdOf(user));
    const progressId = relationId(taskId, userIdOf(user));
    const existing = await db.collection(COLLECTIONS.progress).doc(progressId).get().catch(() => null);
    if (!existing?.data) {
      const now = new Date();
      await db.collection(COLLECTIONS.progress).doc(progressId).set({ data: { taskId, groupId: task.groupId, userId: userIdOf(user), stage: 'learning', studyIndex: 0, startedAt: now, memoryDoneAt: null, submittedAt: null, score: null, correctCount: null, totalCount: task.wordCount, timing: null, updatedAt: now } });
    }
    const words = await db.collection(COLLECTIONS.taskWords).where({ taskId, snapshotVersion: task.snapshotVersion }).orderBy('index', 'asc').limit(LIMITS.maxWordsPerTask).get();
    const progress = existing?.data ?? (await db.collection(COLLECTIONS.progress).doc(progressId).get()).data;
    return { task: cleanTask(task), words: words.data, progress };
  },
  async saveStudyIndex(payload: Doc) {
    const user = await ensureUser();
    const taskId = requireString(payload.taskId, '任务 ID');
    const task = await getTask(taskId);
    await requireMember(String(task.groupId), userIdOf(user));
    const index = Number(payload.studyIndex);
    if (!Number.isInteger(index) || index < 0 || index >= Number(task.wordCount)) throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, '学习进度无效');
    const progressId = relationId(taskId, userIdOf(user));
    await db.collection(COLLECTIONS.progress).doc(progressId).update({ data: { studyIndex: index, updatedAt: new Date() } });
    return { studyIndex: index };
  },
  async completeMemory(payload: Doc) {
    const user = await ensureUser();
    const taskId = requireString(payload.taskId, '任务 ID');
    const task = await getTask(taskId);
    if (task.status === 'withdrawn') throw new BusinessError(ERROR_CODES.TASK_WITHDRAWN, '任务已撤回');
    await requireMember(String(task.groupId), userIdOf(user));
    const progressId = relationId(taskId, userIdOf(user));
    const result = await db.collection(COLLECTIONS.progress).doc(progressId).get().catch(() => null);
    const progress = result?.data as Doc | undefined;
    if (!progress) throw new BusinessError(ERROR_CODES.MEMORY_NOT_COMPLETED, '请先开始学习');
    if (Number(progress.studyIndex) < Number(task.wordCount) - 1) throw new BusinessError(ERROR_CODES.MEMORY_NOT_COMPLETED, '浏览完全部单词后才能完成记忆');
    if (progress.stage === 'submitted') return { stage: 'submitted', idempotent: true };
    const now = new Date();
    await db.collection(COLLECTIONS.progress).doc(progressId).update({ data: { stage: 'ready_for_dictation', memoryDoneAt: progress.memoryDoneAt ?? now, updatedAt: now } });
    return { stage: 'ready_for_dictation', idempotent: progress.stage === 'ready_for_dictation' };
  },
};

const persistSubmissionItems = async (submission: Doc): Promise<void> => {
  const items = Array.isArray(submission.items) ? submission.items as Doc[] : [];
  await runInBatches(items, 20, async (item) => {
    await db.collection(COLLECTIONS.submissionItems).doc(relationId(String(submission._id), String(item.wordId))).set({
      data: {
        submissionId: submission._id,
        taskId: submission.taskId,
        userId: submission.userId,
        wordId: item.wordId,
        answer: item.answer,
        normalizedAnswer: item.normalizedAnswer,
        isCorrect: item.isCorrect,
        createdAt: submission.submittedAt,
      },
    });
  });
};

export const attemptHandlers = {
  async startFormal(payload: Doc) {
    const user = await ensureUser();
    const taskId = requireString(payload.taskId, '任务 ID');
    const task = await getTask(taskId);
    if (task.status === 'withdrawn') throw new BusinessError(ERROR_CODES.TASK_WITHDRAWN, '任务已撤回，不能开始新的正式默写');
    if (task.status !== 'published') throw new BusinessError(ERROR_CODES.TASK_NOT_PUBLISHED, '任务尚未发布');
    await requireMember(String(task.groupId), userIdOf(user));
    const progressId = relationId(taskId, userIdOf(user));
    const progressResult = await db.collection(COLLECTIONS.progress).doc(progressId).get().catch(() => null);
    const progress = progressResult?.data as Doc | undefined;
    if (!progress || !['ready_for_dictation', 'submitted'].includes(String(progress.stage))) throw new BusinessError(ERROR_CODES.MEMORY_NOT_COMPLETED, '完成全部记忆后才能开始默写');
    const submissionId = relationId('formal', taskId, userIdOf(user));
    const words = await db.collection(COLLECTIONS.taskWords).where({ taskId, snapshotVersion: task.snapshotVersion }).orderBy('index', 'asc').limit(LIMITS.maxWordsPerTask).get();
    const questionOrder = shuffle(words.data.map((word: Doc) => String(word._id)));
    const now = new Date();
    return db.runTransaction(async (transaction: Transaction) => {
      const currentTask = await transaction.collection(COLLECTIONS.tasks).doc(taskId).get();
      if ((currentTask.data as Doc).status !== 'published') throw new BusinessError(ERROR_CODES.TASK_WITHDRAWN, '任务已撤回，不能开始新的正式默写');
      const existing = await transaction.collection(COLLECTIONS.submissions).doc(submissionId).get().catch(() => null);
      if (existing?.data) {
        const submission = existing.data as Doc;
        if (submission.status === 'submitted') throw new BusinessError(ERROR_CODES.FORMAL_ALREADY_SUBMITTED, '正式成绩已提交，不能再次答题');
        return { submissionId, questionOrder: submission.questionOrder, resumed: true };
      }
      await transaction.collection(COLLECTIONS.submissions).doc(submissionId).set({ data: { taskId, groupId: task.groupId, userId: userIdOf(user), questionOrder, status: 'in_progress', startedAt: now, submittedAt: null, score: null, correctCount: null, totalCount: questionOrder.length, timing: null } });
      return { submissionId, questionOrder, resumed: false };
    });
  },
  async submitFormal(payload: Doc) {
    const user = await ensureUser();
    const taskId = requireString(payload.taskId, '任务 ID');
    const task = await getTask(taskId);
    if (!['published', 'withdrawn'].includes(String(task.status))) throw new BusinessError(ERROR_CODES.TASK_NOT_PUBLISHED, '任务尚未发布');
    await requireMember(String(task.groupId), userIdOf(user));
    const answers = payload.answers && typeof payload.answers === 'object' ? payload.answers as Record<string, unknown> : {};
    const submissionId = relationId('formal', taskId, userIdOf(user));
    const beforeResult = await db.collection(COLLECTIONS.submissions).doc(submissionId).get().catch(() => null);
    const before = beforeResult?.data as Doc | undefined;
    if (!before) throw new BusinessError(ERROR_CODES.SUBMISSION_NOT_FOUND, '请先开始正式默写');
    if (before.status === 'submitted') {
      await persistSubmissionItems(before);
      throw new BusinessError(ERROR_CODES.FORMAL_ALREADY_SUBMITTED, '正式成绩已提交，不能覆盖');
    }
    const wordsResult = await db.collection(COLLECTIONS.taskWords).where({ taskId, snapshotVersion: task.snapshotVersion }).orderBy('index', 'asc').limit(LIMITS.maxWordsPerTask).get();
    const words = wordsResult.data as Doc[];
    const submittedAt = new Date();
    const deadline = toPlainDate(task.deadline);
    const timing = getSubmissionTiming(submittedAt, deadline);
    const graded = words.map((word) => {
      const answer = typeof answers[String(word._id)] === 'string' ? String(answers[String(word._id)]).slice(0, 100) : '';
      const normalizedAnswer = normalizeAnswer(answer);
      return { wordId: word._id, answer, normalizedAnswer, isCorrect: normalizedAnswer === String(word.normalizedWord) };
    });
    const correctCount = graded.filter((item) => item.isCorrect).length;
    const score = calculateScore(correctCount, words.length);
    await db.runTransaction(async (transaction: Transaction) => {
      const currentResult = await transaction.collection(COLLECTIONS.submissions).doc(submissionId).get().catch(() => null);
      const current = currentResult?.data as Doc | undefined;
      if (!current) throw new BusinessError(ERROR_CODES.SUBMISSION_NOT_FOUND, '请先开始正式默写');
      if (current.status === 'submitted') throw new BusinessError(ERROR_CODES.FORMAL_ALREADY_SUBMITTED, '正式成绩已提交，不能覆盖');
      await transaction.collection(COLLECTIONS.submissions).doc(submissionId).update({ data: { status: 'submitted', submittedAt, score, correctCount, totalCount: words.length, timing, items: graded } });
      await transaction.collection(COLLECTIONS.progress).doc(relationId(taskId, userIdOf(user))).update({ data: { stage: 'submitted', submittedAt, score, correctCount, totalCount: words.length, timing, updatedAt: submittedAt } });
    });
    await persistSubmissionItems({ _id: submissionId, taskId, userId: userIdOf(user), submittedAt, items: graded });
    return { submissionId, score, correctCount, totalCount: words.length, timing };
  },
  async getResult(payload: Doc) {
    const user = await ensureUser();
    const taskId = requireString(payload.taskId, '任务 ID');
    const task = await getTask(taskId);
    const requestedUserId = typeof payload.userId === 'string' ? payload.userId : userIdOf(user);
    if (requestedUserId !== userIdOf(user)) await requireOwner(String(task.groupId), userIdOf(user));
    else await getMembership(String(task.groupId), userIdOf(user));
    const submissionId = relationId('formal', taskId, requestedUserId);
    const result = await db.collection(COLLECTIONS.submissions).doc(submissionId).get().catch(() => null);
    const submission = result?.data as Doc | undefined;
    if (!submission || submission.status !== 'submitted') throw new BusinessError(ERROR_CODES.SUBMISSION_NOT_FOUND, '尚无正式提交结果');
    const items = Array.isArray(submission.items) ? submission.items as Doc[] : [];
    const wordIds = items.map((item) => String(item.wordId));
    const words = await Promise.all(wordIds.map(async (wordId) => (await db.collection(COLLECTIONS.taskWords).doc(wordId).get()).data));
    const wordMap = new Map(words.map((word: Doc) => [String(word._id), word]));
    const { items: _hiddenItems, ...submissionSummary } = submission;
    return { submission: submissionSummary, items: items.map((item) => ({ ...item, word: wordMap.get(String(item.wordId)) })) };
  },
  async startWrongPractice(payload: Doc) {
    const user = await ensureUser();
    const taskId = requireString(payload.taskId, '任务 ID');
    const task = await getTask(taskId);
    await requireMember(String(task.groupId), userIdOf(user));
    const submissionId = relationId('formal', taskId, userIdOf(user));
    const submissionResult = await db.collection(COLLECTIONS.submissions).doc(submissionId).get().catch(() => null);
    const submission = submissionResult?.data as Doc | undefined;
    if (!submission || submission.status !== 'submitted') throw new BusinessError(ERROR_CODES.SUBMISSION_NOT_FOUND, '尚无正式成绩');
    const formalItems = Array.isArray(submission.items) ? submission.items as Doc[] : [];
    const questionOrder = shuffle(formalItems.filter((item) => !item.isCorrect).map((item) => String(item.wordId)));
    if (questionOrder.length === 0) return { practiceId: null, questionOrder: [], message: '正式答卷没有错词' };
    const practiceAdd = await db.collection(COLLECTIONS.wrongWordPractices).add({ data: { taskId, submissionId, userId: userIdOf(user), questionOrder, answers: {}, status: 'practicing', correctCount: null, totalCount: questionOrder.length, score: null, startedAt: new Date(), submittedAt: null } });
    return { practiceId: practiceAdd._id, questionOrder };
  },
  async submitWrongPractice(payload: Doc) {
    const user = await ensureUser();
    const practiceId = requireString(payload.practiceId, '练习 ID');
    const practiceResult = await db.collection(COLLECTIONS.wrongWordPractices).doc(practiceId).get().catch(() => null);
    const practice = practiceResult?.data as Doc | undefined;
    if (!practice || practice.userId !== userIdOf(user)) throw new BusinessError(ERROR_CODES.FORBIDDEN, '无权提交该错词练习');
    if (practice.status === 'completed') return { practiceId, score: practice.score, correctCount: practice.correctCount, totalCount: practice.totalCount, idempotent: true };
    const answers = payload.answers && typeof payload.answers === 'object' ? payload.answers as Record<string, unknown> : {};
    const words = await Promise.all((practice.questionOrder as string[]).map(async (wordId) => (await db.collection(COLLECTIONS.taskWords).doc(wordId).get()).data as Doc));
    const normalizedAnswers: Record<string, string> = {};
    let correctCount = 0;
    words.forEach((word) => {
      const answer = typeof answers[String(word._id)] === 'string' ? String(answers[String(word._id)]).slice(0, 100) : '';
      normalizedAnswers[String(word._id)] = answer;
      if (normalizeAnswer(answer) === word.normalizedWord) correctCount += 1;
    });
    const score = calculateScore(correctCount, words.length);
    await db.collection(COLLECTIONS.wrongWordPractices).doc(practiceId).update({ data: { answers: normalizedAnswers, status: 'completed', correctCount, score, submittedAt: new Date() } });
    return { practiceId, score, correctCount, totalCount: words.length, idempotent: false };
  },
};

export const statsHandlers = {
  async getOwnerStats(payload: Doc) {
    const user = await ensureUser();
    const taskId = requireString(payload.taskId, '任务 ID');
    const task = await getTask(taskId);
    await requireOwner(String(task.groupId), userIdOf(user));
    const memberships = await db.collection(COLLECTIONS.groupMembers).where({ groupId: task.groupId, role: 'member', status: 'active' }).limit(100).get();
    const rows = await Promise.all(memberships.data.map(async (membership: Doc) => {
      const [profileResult, progressResult] = await Promise.all([
        db.collection(COLLECTIONS.users).doc(String(membership.userId)).get().catch(() => null),
        db.collection(COLLECTIONS.progress).doc(relationId(taskId, String(membership.userId))).get().catch(() => null),
      ]);
      const profile = profileResult?.data as Doc | undefined;
      const progress = progressResult?.data as Doc | undefined;
      const submissionResult = progress?.stage === 'submitted'
        ? await db.collection(COLLECTIONS.submissions).doc(relationId('formal', taskId, String(membership.userId))).get().catch(() => null)
        : null;
      const submission = submissionResult?.data as Doc | undefined;
      const wrongCount = Array.isArray(submission?.items) ? submission.items.filter((item: Doc) => !item.isCorrect).length : 0;
      return { userId: membership.userId, nickname: profile?.nickname ?? '微信用户', avatarUrl: profile?.avatarUrl ?? '', stage: progress?.stage ?? 'pending', score: progress?.score ?? null, submittedAt: progress?.submittedAt ?? null, timing: progress?.timing ?? null, wrongCount };
    }));
    const completed = rows.filter((row: Doc) => row.stage === 'submitted');
    return { memberCount: rows.length, completedCount: completed.length, completionRate: rows.length ? Math.round((completed.length / rows.length) * 100) : 0, averageScore: completed.length ? Math.round(completed.reduce((sum: number, row: Doc) => sum + Number(row.score), 0) / completed.length) : null, highestScore: completed.length ? Math.max(...completed.map((row: Doc) => Number(row.score))) : null, lowestScore: completed.length ? Math.min(...completed.map((row: Doc) => Number(row.score))) : null, members: rows };
  },
  async getRanking(payload: Doc) {
    const user = await ensureUser();
    const taskId = requireString(payload.taskId, '任务 ID');
    const task = await getTask(taskId);
    await getMembership(String(task.groupId), userIdOf(user));
    const memberships = await db.collection(COLLECTIONS.groupMembers).where({ groupId: task.groupId, role: 'member', status: 'active' }).limit(100).get();
    const entries: Array<Omit<RankingEntry, 'rank'>> = [];
    const unfinished: Doc[] = [];
    for (const membership of memberships.data as Doc[]) {
      const [profileResult, progressResult] = await Promise.all([
        db.collection(COLLECTIONS.users).doc(String(membership.userId)).get().catch(() => null),
        db.collection(COLLECTIONS.progress).doc(relationId(taskId, String(membership.userId))).get().catch(() => null),
      ]);
      const profile = profileResult?.data as Doc | undefined;
      const progress = progressResult?.data as Doc | undefined;
      const base = { userId: membership.userId, nickname: profile?.nickname ?? '微信用户', avatarUrl: profile?.avatarUrl ?? '' };
      if (progress?.stage === 'submitted') entries.push({ ...base, score: Number(progress.score), submittedAt: progress.submittedAt, timing: progress.timing });
      else unfinished.push({ ...base, stage: progress?.stage ?? 'pending' });
    }
    return { ranking: assignRanks(entries), unfinished };
  },
};
