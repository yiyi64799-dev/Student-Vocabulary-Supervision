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

// cloudfunctions/study/src/index.ts
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
var getTask = async (taskId) => {
  const result = await db.collection(COLLECTIONS.tasks).doc(taskId).get().catch(() => null);
  const task = result == null ? void 0 : result.data;
  if (!task) throw new BusinessError(ERROR_CODES.TASK_NOT_FOUND, "\u4EFB\u52A1\u4E0D\u5B58\u5728");
  return task;
};

// cloudfunctions/_shared/domain.ts
var userIdOf = (user) => String(user._id);
var cleanTask = (task) => ({ ...task, draftWords: task.status === "draft" ? task.draftWords ?? [] : void 0 });
var studyHandlers = {
  async startOrResume(payload) {
    const user = await ensureUser();
    const taskId = requireString(payload.taskId, "\u4EFB\u52A1 ID");
    const task = await getTask(taskId);
    if (task.status === "withdrawn") throw new BusinessError(ERROR_CODES.TASK_WITHDRAWN, "\u4EFB\u52A1\u5DF2\u64A4\u56DE");
    if (task.status !== "published") throw new BusinessError(ERROR_CODES.TASK_NOT_PUBLISHED, "\u4EFB\u52A1\u5C1A\u672A\u53D1\u5E03");
    await requireMember(String(task.groupId), userIdOf(user));
    const progressId = relationId(taskId, userIdOf(user));
    const existing = await db.collection(COLLECTIONS.progress).doc(progressId).get().catch(() => null);
    if (!(existing == null ? void 0 : existing.data)) {
      const now = /* @__PURE__ */ new Date();
      await db.collection(COLLECTIONS.progress).doc(progressId).set({ data: { taskId, groupId: task.groupId, userId: userIdOf(user), stage: "learning", studyIndex: 0, startedAt: now, memoryDoneAt: null, submittedAt: null, score: null, correctCount: null, totalCount: task.wordCount, timing: null, updatedAt: now } });
    }
    const words = await db.collection(COLLECTIONS.taskWords).where({ taskId, snapshotVersion: task.snapshotVersion }).orderBy("index", "asc").limit(LIMITS.maxWordsPerTask).get();
    const progress = (existing == null ? void 0 : existing.data) ?? (await db.collection(COLLECTIONS.progress).doc(progressId).get()).data;
    return { task: cleanTask(task), words: words.data, progress };
  },
  async saveStudyIndex(payload) {
    const user = await ensureUser();
    const taskId = requireString(payload.taskId, "\u4EFB\u52A1 ID");
    const task = await getTask(taskId);
    await requireMember(String(task.groupId), userIdOf(user));
    const index = Number(payload.studyIndex);
    if (!Number.isInteger(index) || index < 0 || index >= Number(task.wordCount)) throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, "\u5B66\u4E60\u8FDB\u5EA6\u65E0\u6548");
    const progressId = relationId(taskId, userIdOf(user));
    await db.collection(COLLECTIONS.progress).doc(progressId).update({ data: { studyIndex: index, updatedAt: /* @__PURE__ */ new Date() } });
    return { studyIndex: index };
  },
  async completeMemory(payload) {
    const user = await ensureUser();
    const taskId = requireString(payload.taskId, "\u4EFB\u52A1 ID");
    const task = await getTask(taskId);
    if (task.status === "withdrawn") throw new BusinessError(ERROR_CODES.TASK_WITHDRAWN, "\u4EFB\u52A1\u5DF2\u64A4\u56DE");
    await requireMember(String(task.groupId), userIdOf(user));
    const progressId = relationId(taskId, userIdOf(user));
    const result = await db.collection(COLLECTIONS.progress).doc(progressId).get().catch(() => null);
    const progress = result == null ? void 0 : result.data;
    if (!progress) throw new BusinessError(ERROR_CODES.MEMORY_NOT_COMPLETED, "\u8BF7\u5148\u5F00\u59CB\u5B66\u4E60");
    if (Number(progress.studyIndex) < Number(task.wordCount) - 1) throw new BusinessError(ERROR_CODES.MEMORY_NOT_COMPLETED, "\u6D4F\u89C8\u5B8C\u5168\u90E8\u5355\u8BCD\u540E\u624D\u80FD\u5B8C\u6210\u8BB0\u5FC6");
    if (progress.stage === "submitted") return { stage: "submitted", idempotent: true };
    const now = /* @__PURE__ */ new Date();
    await db.collection(COLLECTIONS.progress).doc(progressId).update({ data: { stage: "ready_for_dictation", memoryDoneAt: progress.memoryDoneAt ?? now, updatedAt: now } });
    return { stage: "ready_for_dictation", idempotent: progress.stage === "ready_for_dictation" };
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

// cloudfunctions/study/src/index.ts
var main = (event) => route(event, studyHandlers);
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  main
});
