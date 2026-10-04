"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// cloudfunctions/attempt/src/index.ts
var index_exports = {};
__export(index_exports, {
  main: () => main
});
module.exports = __toCommonJS(index_exports);

// shared/constants/index.ts
var COLLECTIONS = {
  users: "users",
  teacherCodes: "teacher_activation_codes",
  groups: "groups",
  groupMembers: "group_members",
  tasks: "tasks",
  taskWords: "task_words",
  progress: "member_task_progress",
  submissions: "submissions",
  submissionItems: "submission_items",
  wrongWordPractices: "wrong_word_practices",
  wrongWordStats: "wrong_word_stats"
};
var LIMITS = {
  groupNameMin: 2,
  groupNameMax: 30,
  groupDescriptionMax: 100,
  taskTitleMin: 2,
  taskTitleMax: 40,
  maxWordsPerTask: 200,
  wordMax: 60,
  meaningMax: 200,
  phoneticMax: 100,
  exampleMax: 500,
  pageSize: 20
};
var ERROR_CODES = {
  TEACHER_REQUIRED: "TEACHER_REQUIRED",
  INVALID_TEACHER_CODE: "INVALID_TEACHER_CODE",
  ACTIVATION_RATE_LIMITED: "ACTIVATION_RATE_LIMITED",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  GROUP_NOT_FOUND: "GROUP_NOT_FOUND",
  INVALID_INVITE_CODE: "INVALID_INVITE_CODE",
  ALREADY_IN_GROUP: "ALREADY_IN_GROUP",
  TASK_NOT_FOUND: "TASK_NOT_FOUND",
  TASK_NOT_PUBLISHED: "TASK_NOT_PUBLISHED",
  TASK_WITHDRAWN: "TASK_WITHDRAWN",
  MEMORY_NOT_COMPLETED: "MEMORY_NOT_COMPLETED",
  FORMAL_ALREADY_SUBMITTED: "FORMAL_ALREADY_SUBMITTED",
  SUBMISSION_NOT_FOUND: "SUBMISSION_NOT_FOUND",
  TOO_MANY_WORDS: "TOO_MANY_WORDS",
  INTERNAL_ERROR: "INTERNAL_ERROR"
};

// cloudfunctions/_shared/runtime.ts
var import_wx_server_sdk = __toESM(require("wx-server-sdk"));

// cloudfunctions/_shared/ids.ts
var import_node_crypto = require("node:crypto");
var relationId = (...parts) => (0, import_node_crypto.createHash)("sha256").update(parts.join(":")).digest("hex").slice(0, 48);

// cloudfunctions/_shared/runtime.ts
import_wx_server_sdk.default.init({ env: import_wx_server_sdk.default.DYNAMIC_CURRENT_ENV });
var db = import_wx_server_sdk.default.database({ throwOnNotFound: false });
var command = db.command;
var BusinessError = class extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = "BusinessError";
  }
};
var ok = (data) => ({ success: true, data });
var fail = (error) => {
  if (error instanceof BusinessError) {
    return { success: false, error: { code: error.code, message: error.message, details: error.details } };
  }
  console.error("Unhandled cloud function error", error);
  return { success: false, error: { code: ERROR_CODES.INTERNAL_ERROR, message: "\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5" } };
};
var requireString = (value, label) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, `${label}\u4E0D\u80FD\u4E3A\u7A7A`);
  }
  return value.trim();
};
var getOpenId = () => {
  const { OPENID } = import_wx_server_sdk.default.getWXContext();
  if (!OPENID) throw new BusinessError(ERROR_CODES.UNAUTHORIZED, "\u65E0\u6CD5\u83B7\u53D6\u767B\u5F55\u8EAB\u4EFD");
  return OPENID;
};
var ensureUser = async () => {
  const openid = getOpenId();
  const userId = relationId("user", openid);
  const result = await db.collection(COLLECTIONS.users).doc(userId).get();
  const existing = result == null ? void 0 : result.data;
  if (existing) return existing;
  return db.runTransaction(async (transaction) => {
    const ref = transaction.collection(COLLECTIONS.users).doc(userId);
    const current = await ref.get();
    if (current.data) return current.data;
    const now = /* @__PURE__ */ new Date();
    const data = { openid, nickname: "\u5FAE\u4FE1\u7528\u6237", avatarUrl: "", accountRole: "student", createdAt: now, updatedAt: now };
    await ref.set({ data });
    return { _id: userId, ...data };
  });
};
var getMembership = async (groupId, userId) => {
  const result = await db.collection(COLLECTIONS.groupMembers).doc(relationId(groupId, userId)).get().catch(() => null);
  const member = result == null ? void 0 : result.data;
  if (!member || member.status !== "active") throw new BusinessError(ERROR_CODES.FORBIDDEN, "\u4F60\u4E0D\u662F\u8BE5\u5C0F\u7EC4\u7684\u6709\u6548\u6210\u5458");
  return member;
};
var requireMember = async (groupId, userId) => {
  const membership = await getMembership(groupId, userId);
  if (membership.role !== "member") throw new BusinessError(ERROR_CODES.FORBIDDEN, "Owner \u4E0D\u53C2\u4E0E\u672C\u7EC4\u5B66\u4E60\u4EFB\u52A1");
  return membership;
};
var requireOwner = async (groupId, userId) => {
  const groupResult = await db.collection(COLLECTIONS.groups).doc(groupId).get().catch(() => null);
  const group = groupResult == null ? void 0 : groupResult.data;
  if (!group) throw new BusinessError(ERROR_CODES.GROUP_NOT_FOUND, "\u5C0F\u7EC4\u4E0D\u5B58\u5728");
  if (group.ownerId !== userId) throw new BusinessError(ERROR_CODES.FORBIDDEN, "\u4EC5\u5C0F\u7EC4 Owner \u53EF\u6267\u884C\u6B64\u64CD\u4F5C");
  return group;
};
var getTask = async (taskId) => {
  const result = await db.collection(COLLECTIONS.tasks).doc(taskId).get().catch(() => null);
  const task = result == null ? void 0 : result.data;
  if (!task) throw new BusinessError(ERROR_CODES.TASK_NOT_FOUND, "\u4EFB\u52A1\u4E0D\u5B58\u5728");
  return task;
};
var toPlainDate = (value) => {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate();
  }
  return new Date(value);
};

// shared/core/index.ts
var normalizeAnswer = (value) => value.trim().toLowerCase();
var calculateScore = (correctCount, totalCount) => totalCount <= 0 ? 0 : Math.round(correctCount / totalCount * 100);
var getSubmissionTiming = (submittedAt, deadline) => submittedAt.getTime() > deadline.getTime() ? "overdue" : "on_time";
var shuffle = (items, random = Math.random) => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
};

// cloudfunctions/_shared/domain.ts
var userIdOf = (user) => String(user._id);
var runInBatches = async (items, size, worker) => {
  for (let offset = 0; offset < items.length; offset += size) {
    const batch = items.slice(offset, offset + size);
    await Promise.all(batch.map((item, index) => worker(item, offset + index)));
  }
};
var persistSubmissionItems = async (submission) => {
  const items = Array.isArray(submission.items) ? submission.items : [];
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
        createdAt: submission.submittedAt
      }
    });
  });
};
var attemptHandlers = {
  async startFormal(payload) {
    const user = await ensureUser();
    const taskId = requireString(payload.taskId, "\u4EFB\u52A1 ID");
    const task = await getTask(taskId);
    if (task.status === "withdrawn") throw new BusinessError(ERROR_CODES.TASK_WITHDRAWN, "\u4EFB\u52A1\u5DF2\u64A4\u56DE\uFF0C\u4E0D\u80FD\u5F00\u59CB\u65B0\u7684\u6B63\u5F0F\u9ED8\u5199");
    if (task.status !== "published") throw new BusinessError(ERROR_CODES.TASK_NOT_PUBLISHED, "\u4EFB\u52A1\u5C1A\u672A\u53D1\u5E03");
    await requireMember(String(task.groupId), userIdOf(user));
    const progressId = relationId(taskId, userIdOf(user));
    const progressResult = await db.collection(COLLECTIONS.progress).doc(progressId).get().catch(() => null);
    const progress = progressResult == null ? void 0 : progressResult.data;
    if (!progress || !["ready_for_dictation", "submitted"].includes(String(progress.stage))) throw new BusinessError(ERROR_CODES.MEMORY_NOT_COMPLETED, "\u5B8C\u6210\u5168\u90E8\u8BB0\u5FC6\u540E\u624D\u80FD\u5F00\u59CB\u9ED8\u5199");
    const submissionId = relationId("formal", taskId, userIdOf(user));
    const words = await db.collection(COLLECTIONS.taskWords).where({ taskId, snapshotVersion: task.snapshotVersion }).orderBy("index", "asc").limit(LIMITS.maxWordsPerTask).get();
    const questionOrder = shuffle(words.data.map((word) => String(word._id)));
    const now = /* @__PURE__ */ new Date();
    return db.runTransaction(async (transaction) => {
      const currentTask = await transaction.collection(COLLECTIONS.tasks).doc(taskId).get();
      if (currentTask.data.status !== "published") throw new BusinessError(ERROR_CODES.TASK_WITHDRAWN, "\u4EFB\u52A1\u5DF2\u64A4\u56DE\uFF0C\u4E0D\u80FD\u5F00\u59CB\u65B0\u7684\u6B63\u5F0F\u9ED8\u5199");
      const existing = await transaction.collection(COLLECTIONS.submissions).doc(submissionId).get().catch(() => null);
      if (existing == null ? void 0 : existing.data) {
        const submission = existing.data;
        if (submission.status === "submitted") throw new BusinessError(ERROR_CODES.FORMAL_ALREADY_SUBMITTED, "\u6B63\u5F0F\u6210\u7EE9\u5DF2\u63D0\u4EA4\uFF0C\u4E0D\u80FD\u518D\u6B21\u7B54\u9898");
        return { submissionId, questionOrder: submission.questionOrder, resumed: true };
      }
      await transaction.collection(COLLECTIONS.submissions).doc(submissionId).set({ data: { taskId, groupId: task.groupId, userId: userIdOf(user), questionOrder, status: "in_progress", startedAt: now, submittedAt: null, score: null, correctCount: null, totalCount: questionOrder.length, timing: null } });
      return { submissionId, questionOrder, resumed: false };
    });
  },
  async submitFormal(payload) {
    const user = await ensureUser();
    const taskId = requireString(payload.taskId, "\u4EFB\u52A1 ID");
    const task = await getTask(taskId);
    if (!["published", "withdrawn"].includes(String(task.status))) throw new BusinessError(ERROR_CODES.TASK_NOT_PUBLISHED, "\u4EFB\u52A1\u5C1A\u672A\u53D1\u5E03");
    await requireMember(String(task.groupId), userIdOf(user));
    const answers = payload.answers && typeof payload.answers === "object" ? payload.answers : {};
    const submissionId = relationId("formal", taskId, userIdOf(user));
    const beforeResult = await db.collection(COLLECTIONS.submissions).doc(submissionId).get().catch(() => null);
    const before = beforeResult == null ? void 0 : beforeResult.data;
    if (!before) throw new BusinessError(ERROR_CODES.SUBMISSION_NOT_FOUND, "\u8BF7\u5148\u5F00\u59CB\u6B63\u5F0F\u9ED8\u5199");
    if (before.status === "submitted") {
      await persistSubmissionItems(before);
      throw new BusinessError(ERROR_CODES.FORMAL_ALREADY_SUBMITTED, "\u6B63\u5F0F\u6210\u7EE9\u5DF2\u63D0\u4EA4\uFF0C\u4E0D\u80FD\u8986\u76D6");
    }
    const wordsResult = await db.collection(COLLECTIONS.taskWords).where({ taskId, snapshotVersion: task.snapshotVersion }).orderBy("index", "asc").limit(LIMITS.maxWordsPerTask).get();
    const words = wordsResult.data;
    const submittedAt = /* @__PURE__ */ new Date();
    const deadline = toPlainDate(task.deadline);
    const timing = getSubmissionTiming(submittedAt, deadline);
    const graded = words.map((word) => {
      const answer = typeof answers[String(word._id)] === "string" ? String(answers[String(word._id)]).slice(0, 100) : "";
      const normalizedAnswer = normalizeAnswer(answer);
      return { wordId: word._id, answer, normalizedAnswer, isCorrect: normalizedAnswer === String(word.normalizedWord) };
    });
    const correctCount = graded.filter((item) => item.isCorrect).length;
    const score = calculateScore(correctCount, words.length);
    await db.runTransaction(async (transaction) => {
      const currentResult = await transaction.collection(COLLECTIONS.submissions).doc(submissionId).get().catch(() => null);
      const current = currentResult == null ? void 0 : currentResult.data;
      if (!current) throw new BusinessError(ERROR_CODES.SUBMISSION_NOT_FOUND, "\u8BF7\u5148\u5F00\u59CB\u6B63\u5F0F\u9ED8\u5199");
      if (current.status === "submitted") throw new BusinessError(ERROR_CODES.FORMAL_ALREADY_SUBMITTED, "\u6B63\u5F0F\u6210\u7EE9\u5DF2\u63D0\u4EA4\uFF0C\u4E0D\u80FD\u8986\u76D6");
      await transaction.collection(COLLECTIONS.submissions).doc(submissionId).update({ data: { status: "submitted", submittedAt, score, correctCount, totalCount: words.length, timing, items: graded } });
      await transaction.collection(COLLECTIONS.progress).doc(relationId(taskId, userIdOf(user))).update({ data: { stage: "submitted", submittedAt, score, correctCount, totalCount: words.length, timing, updatedAt: submittedAt } });
    });
    await persistSubmissionItems({ _id: submissionId, taskId, userId: userIdOf(user), submittedAt, items: graded });
    return { submissionId, score, correctCount, totalCount: words.length, timing };
  },
  async getResult(payload) {
    const user = await ensureUser();
    const taskId = requireString(payload.taskId, "\u4EFB\u52A1 ID");
    const task = await getTask(taskId);
    const requestedUserId = typeof payload.userId === "string" ? payload.userId : userIdOf(user);
    if (requestedUserId !== userIdOf(user)) await requireOwner(String(task.groupId), userIdOf(user));
    else await getMembership(String(task.groupId), userIdOf(user));
    const submissionId = relationId("formal", taskId, requestedUserId);
    const result = await db.collection(COLLECTIONS.submissions).doc(submissionId).get().catch(() => null);
    const submission = result == null ? void 0 : result.data;
    if (!submission || submission.status !== "submitted") throw new BusinessError(ERROR_CODES.SUBMISSION_NOT_FOUND, "\u5C1A\u65E0\u6B63\u5F0F\u63D0\u4EA4\u7ED3\u679C");
    const items = Array.isArray(submission.items) ? submission.items : [];
    const wordIds = items.map((item) => String(item.wordId));
    const words = await Promise.all(wordIds.map(async (wordId) => (await db.collection(COLLECTIONS.taskWords).doc(wordId).get()).data));
    const wordMap = new Map(words.map((word) => [String(word._id), word]));
    const { items: _hiddenItems, ...submissionSummary } = submission;
    return { submission: submissionSummary, items: items.map((item) => ({ ...item, word: wordMap.get(String(item.wordId)) })) };
  },
  async startWrongPractice(payload) {
    const user = await ensureUser();
    const taskId = requireString(payload.taskId, "\u4EFB\u52A1 ID");
    const task = await getTask(taskId);
    await requireMember(String(task.groupId), userIdOf(user));
    const submissionId = relationId("formal", taskId, userIdOf(user));
    const submissionResult = await db.collection(COLLECTIONS.submissions).doc(submissionId).get().catch(() => null);
    const submission = submissionResult == null ? void 0 : submissionResult.data;
    if (!submission || submission.status !== "submitted") throw new BusinessError(ERROR_CODES.SUBMISSION_NOT_FOUND, "\u5C1A\u65E0\u6B63\u5F0F\u6210\u7EE9");
    const formalItems = Array.isArray(submission.items) ? submission.items : [];
    const questionOrder = shuffle(formalItems.filter((item) => !item.isCorrect).map((item) => String(item.wordId)));
    if (questionOrder.length === 0) return { practiceId: null, questionOrder: [], message: "\u6B63\u5F0F\u7B54\u5377\u6CA1\u6709\u9519\u8BCD" };
    const practiceAdd = await db.collection(COLLECTIONS.wrongWordPractices).add({ data: { taskId, submissionId, userId: userIdOf(user), questionOrder, answers: {}, status: "practicing", correctCount: null, totalCount: questionOrder.length, score: null, startedAt: /* @__PURE__ */ new Date(), submittedAt: null } });
    return { practiceId: practiceAdd._id, questionOrder };
  },
  async submitWrongPractice(payload) {
    const user = await ensureUser();
    const practiceId = requireString(payload.practiceId, "\u7EC3\u4E60 ID");
    const practiceResult = await db.collection(COLLECTIONS.wrongWordPractices).doc(practiceId).get().catch(() => null);
    const practice = practiceResult == null ? void 0 : practiceResult.data;
    if (!practice || practice.userId !== userIdOf(user)) throw new BusinessError(ERROR_CODES.FORBIDDEN, "\u65E0\u6743\u63D0\u4EA4\u8BE5\u9519\u8BCD\u7EC3\u4E60");
    if (practice.status === "completed") return { practiceId, score: practice.score, correctCount: practice.correctCount, totalCount: practice.totalCount, idempotent: true };
    const answers = payload.answers && typeof payload.answers === "object" ? payload.answers : {};
    const words = await Promise.all(practice.questionOrder.map(async (wordId) => (await db.collection(COLLECTIONS.taskWords).doc(wordId).get()).data));
    const normalizedAnswers = {};
    let correctCount = 0;
    words.forEach((word) => {
      const answer = typeof answers[String(word._id)] === "string" ? String(answers[String(word._id)]).slice(0, 100) : "";
      normalizedAnswers[String(word._id)] = answer;
      if (normalizeAnswer(answer) === word.normalizedWord) correctCount += 1;
    });
    const score = calculateScore(correctCount, words.length);
    await db.collection(COLLECTIONS.wrongWordPractices).doc(practiceId).update({ data: { answers: normalizedAnswers, status: "completed", correctCount, score, submittedAt: /* @__PURE__ */ new Date() } });
    return { practiceId, score, correctCount, totalCount: words.length, idempotent: false };
  }
};

// cloudfunctions/_shared/router.ts
var route = async (event, handlers) => {
  try {
    if (!event || typeof event.action !== "string" || !handlers[event.action]) {
      throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, "\u672A\u77E5\u64CD\u4F5C");
    }
    const handler = handlers[event.action];
    if (!handler) throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, "\u672A\u77E5\u64CD\u4F5C");
    const data = await handler(event.payload ?? {});
    return ok(data);
  } catch (error) {
    return fail(error);
  }
};

// cloudfunctions/attempt/src/index.ts
var main = (event) => route(event, attemptHandlers);
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  main
});
