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

// cloudfunctions/task/src/index.ts
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
var stableHash = (value) => (0, import_node_crypto.createHash)("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 20);

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
var parseDate = (value, label = "\u65F6\u95F4") => {
  const date = value instanceof Date ? value : new Date(typeof value === "string" || typeof value === "number" ? value : "");
  if (Number.isNaN(date.getTime())) throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, `${label}\u683C\u5F0F\u65E0\u6548`);
  return date;
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
var assignRanks = (rows) => {
  const sorted = [...rows].sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return new Date(left.submittedAt).getTime() - new Date(right.submittedAt).getTime();
  });
  let currentRank = 1;
  return sorted.map((row, index) => {
    const previous = sorted[index - 1];
    const isTie = previous && previous.score === row.score && new Date(previous.submittedAt).getTime() === new Date(row.submittedAt).getTime();
    if (!isTie) currentRank = index + 1;
    return { ...row, rank: currentRank };
  });
};
var splitLine = (line) => {
  if (line.includes("	")) return line.split("	");
  if (line.includes("|")) return line.split("|");
  if (line.includes("\uFF0C")) return line.split("\uFF0C");
  return line.split(",");
};
var parseWordImport = (text, limits = { wordMax: 60, meaningMax: 200 }) => {
  const validRows = [];
  const issues = [];
  const seen = /* @__PURE__ */ new Set();
  let duplicateCount = 0;
  text.split(/\r?\n/).forEach((raw, offset) => {
    if (!raw.trim()) return;
    const [wordValue = "", meaningValue = "", phonetic = "", example = ""] = splitLine(raw);
    const word = wordValue.trim();
    const meaning = meaningValue.trim();
    const line = offset + 1;
    if (!word || !meaning) {
      issues.push({ line, raw, code: !word ? "MISSING_WORD" : "MISSING_MEANING", message: !word ? "\u7F3A\u5C11\u5355\u8BCD" : "\u7F3A\u5C11\u91CA\u4E49" });
      return;
    }
    if (word.length > limits.wordMax || meaning.length > limits.meaningMax) {
      issues.push({ line, raw, code: word.length > limits.wordMax ? "WORD_TOO_LONG" : "MEANING_TOO_LONG", message: "\u5B57\u6BB5\u957F\u5EA6\u8D85\u8FC7\u9650\u5236" });
      return;
    }
    const key = normalizeAnswer(word);
    if (seen.has(key)) {
      duplicateCount += 1;
      issues.push({ line, raw, code: "DUPLICATE", message: "\u4EFB\u52A1\u5185\u91CD\u590D\u5355\u8BCD\uFF0C\u5DF2\u4FDD\u7559\u9996\u6B21\u51FA\u73B0" });
      return;
    }
    seen.add(key);
    validRows.push({ word, meaning, phonetic: phonetic.trim(), example: example.trim() });
  });
  return {
    validRows,
    issues,
    validCount: validRows.length,
    errorCount: issues.filter((issue) => issue.code !== "DUPLICATE").length,
    duplicateCount
  };
};

// shared/validators/index.ts
var validateTaskWords = (value) => {
  if (!Array.isArray(value)) return { words: [], errors: ["\u5355\u8BCD\u5217\u8868\u683C\u5F0F\u65E0\u6548"] };
  if (value.length === 0) return { words: [], errors: ["\u81F3\u5C11\u9700\u8981 1 \u4E2A\u5355\u8BCD"] };
  if (value.length > LIMITS.maxWordsPerTask) return { words: [], errors: [`\u5355\u4E2A\u4EFB\u52A1\u4E0D\u80FD\u8D85\u8FC7 ${LIMITS.maxWordsPerTask} \u4E2A\u5355\u8BCD`] };
  const words = [];
  const errors = [];
  const seen = /* @__PURE__ */ new Set();
  value.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      errors.push(`\u7B2C ${index + 1} \u884C\u683C\u5F0F\u65E0\u6548`);
      return;
    }
    const record = item;
    const word = typeof record.word === "string" ? record.word.trim() : "";
    const meaning = typeof record.meaning === "string" ? record.meaning.trim() : "";
    if (!word || !meaning || word.length > LIMITS.wordMax || meaning.length > LIMITS.meaningMax) {
      errors.push(`\u7B2C ${index + 1} \u884C\u7684\u5355\u8BCD\u6216\u91CA\u4E49\u65E0\u6548`);
      return;
    }
    const key = normalizeAnswer(word);
    if (seen.has(key)) {
      errors.push(`\u7B2C ${index + 1} \u884C\u4E0E\u4EFB\u52A1\u5185\u5176\u4ED6\u5355\u8BCD\u91CD\u590D`);
      return;
    }
    seen.add(key);
    words.push({
      word,
      meaning,
      phonetic: typeof record.phonetic === "string" ? record.phonetic.trim() : "",
      example: typeof record.example === "string" ? record.example.trim() : ""
    });
  });
  return { words, errors };
};

// cloudfunctions/_shared/domain.ts
var userIdOf = (user) => String(user._id);
var cleanTask = (task) => ({ ...task, draftWords: task.status === "draft" ? task.draftWords ?? [] : void 0 });
var runInBatches = async (items, size, worker) => {
  for (let offset = 0; offset < items.length; offset += size) {
    const batch = items.slice(offset, offset + size);
    await Promise.all(batch.map((item, index) => worker(item, offset + index)));
  }
};
var taskHandlers = {
  async previewStudent(payload) {
    const user = await ensureUser();
    const taskId = requireString(payload.taskId, "\u4EFB\u52A1 ID");
    const task = await getTask(taskId);
    await requireOwner(String(task.groupId), userIdOf(user));
    if (user.accountRole !== "teacher") throw new BusinessError(ERROR_CODES.TEACHER_REQUIRED, "\u8BF7\u5148\u5F00\u901A\u6559\u5E08\u8EAB\u4EFD");
    if (task.status !== "published") throw new BusinessError(task.status === "withdrawn" ? ERROR_CODES.TASK_WITHDRAWN : ERROR_CODES.TASK_NOT_PUBLISHED, "\u4EC5\u5DF2\u53D1\u5E03\u4E14\u672A\u64A4\u56DE\u7684\u4EFB\u52A1\u53EF\u4EE5\u9884\u89C8");
    const result = await db.collection(COLLECTIONS.taskWords).where({ taskId, snapshotVersion: task.snapshotVersion }).orderBy("index", "asc").limit(LIMITS.maxWordsPerTask).get();
    if (result.data.length !== task.wordCount) throw new BusinessError(ERROR_CODES.INTERNAL_ERROR, "\u8BCD\u8868\u4E0D\u5B8C\u6574\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
    return { title: task.title, words: result.data };
  },
  async getOwnerView(payload) {
    const user = await ensureUser();
    const taskId = requireString(payload.taskId, "\u4EFB\u52A1 ID");
    const task = await getTask(taskId);
    await requireOwner(String(task.groupId), userIdOf(user));
    return cleanTask(task);
  },
  async createDraft(payload) {
    const user = await ensureUser();
    const groupId = requireString(payload.groupId, "\u5C0F\u7EC4 ID");
    await requireOwner(groupId, userIdOf(user));
    const title = typeof payload.title === "string" && payload.title.trim() ? payload.title.trim().slice(0, 40) : "\u672A\u547D\u540D\u4EFB\u52A1";
    const idempotencyKey = requireString(payload.idempotencyKey, "\u5E42\u7B49\u952E").slice(0, 100);
    const taskId = relationId("task-create", userIdOf(user), idempotencyKey);
    return db.runTransaction(async (transaction) => {
      const existing = await transaction.collection(COLLECTIONS.tasks).doc(taskId).get().catch(() => null);
      if (existing == null ? void 0 : existing.data) {
        const task = existing.data;
        if (task.ownerId !== userIdOf(user) || task.groupId !== groupId) throw new BusinessError(ERROR_CODES.FORBIDDEN, "\u5E42\u7B49\u952E\u51B2\u7A81");
        return { taskId, idempotent: true };
      }
      const now = /* @__PURE__ */ new Date();
      await transaction.collection(COLLECTIONS.tasks).doc(taskId).set({ data: { groupId, ownerId: userIdOf(user), title, deadline: null, status: "draft", wordCount: 0, draftWords: [], publishedAt: null, withdrawnAt: null, createdAt: now, updatedAt: now } });
      return { taskId, idempotent: false };
    });
  },
  async updateDraft(payload) {
    const user = await ensureUser();
    const taskId = requireString(payload.taskId, "\u4EFB\u52A1 ID");
    const task = await getTask(taskId);
    await requireOwner(String(task.groupId), userIdOf(user));
    if (task.status !== "draft") throw new BusinessError(ERROR_CODES.FORBIDDEN, "\u5DF2\u53D1\u5E03\u4EFB\u52A1\u4E0D\u53EF\u7F16\u8F91");
    const title = requireString(payload.title, "\u4EFB\u52A1\u6807\u9898");
    if (title.length < 2 || title.length > 40) throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, "\u4EFB\u52A1\u6807\u9898\u9700\u4E3A 2-40 \u4E2A\u5B57\u7B26");
    const { words, errors } = validateTaskWords(payload.words ?? []);
    if (errors.length && Array.isArray(payload.words) && payload.words.length > 0) throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, errors[0], { errors });
    const deadline = payload.deadline ? parseDate(payload.deadline, "\u622A\u6B62\u65F6\u95F4") : null;
    await db.collection(COLLECTIONS.tasks).doc(taskId).update({ data: { title, deadline, draftWords: words, wordCount: words.length, updatedAt: /* @__PURE__ */ new Date() } });
    return { taskId, wordCount: words.length };
  },
  async importPreview(payload) {
    const user = await ensureUser();
    const taskId = requireString(payload.taskId, "\u4EFB\u52A1 ID");
    const task = await getTask(taskId);
    await requireOwner(String(task.groupId), userIdOf(user));
    if (task.status !== "draft") throw new BusinessError(ERROR_CODES.FORBIDDEN, "\u53EA\u6709\u8349\u7A3F\u4EFB\u52A1\u53EF\u4EE5\u5BFC\u5165\u5355\u8BCD");
    const text = requireString(payload.text, "\u7C98\u8D34\u6587\u672C");
    if (/\.xlsx\s*$/i.test(text.trim())) throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, "V1 \u4E0D\u652F\u6301\u4E0A\u4F20\u6216\u89E3\u6790 .xlsx\uFF0C\u8BF7\u4ECE Excel/WPS \u590D\u5236\u4E24\u5217\u540E\u7C98\u8D34");
    return parseWordImport(text, { wordMax: LIMITS.wordMax, meaningMax: LIMITS.meaningMax });
  },
  async publish(payload) {
    const user = await ensureUser();
    const taskId = requireString(payload.taskId, "\u4EFB\u52A1 ID");
    const task = await getTask(taskId);
    await requireOwner(String(task.groupId), userIdOf(user));
    if (task.status === "published") return { taskId, published: true, idempotent: true };
    if (task.status === "withdrawn") throw new BusinessError(ERROR_CODES.TASK_WITHDRAWN, "\u5DF2\u64A4\u56DE\u4EFB\u52A1\u4E0D\u80FD\u91CD\u65B0\u53D1\u5E03\uFF0C\u8BF7\u590D\u5236\u4E3A\u65B0\u4EFB\u52A1");
    const { words, errors } = validateTaskWords(task.draftWords);
    if (errors.length) throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, errors[0], { errors });
    const deadline = task.deadline ? toPlainDate(task.deadline) : null;
    if (!deadline || deadline.getTime() <= Date.now()) throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, "\u53D1\u5E03\u65F6\u95F4\u524D\u5FC5\u987B\u8BBE\u7F6E\u665A\u4E8E\u5F53\u524D\u65F6\u95F4\u7684\u622A\u6B62\u65F6\u95F4");
    const snapshotVersion = stableHash(words);
    const now = /* @__PURE__ */ new Date();
    await runInBatches(words, 20, async (word, index) => {
      await db.collection(COLLECTIONS.taskWords).doc(relationId(taskId, snapshotVersion, String(index))).set({ data: { taskId, snapshotVersion, index, ...word, normalizedWord: normalizeAnswer(word.word), createdAt: now } });
    });
    await db.runTransaction(async (transaction) => {
      const locked = await transaction.collection(COLLECTIONS.tasks).doc(taskId).get();
      const current = locked.data;
      if (current.status === "published") return;
      if (current.status !== "draft") throw new BusinessError(ERROR_CODES.TASK_WITHDRAWN, "\u4EFB\u52A1\u72B6\u6001\u4E0D\u5141\u8BB8\u53D1\u5E03");
      if (stableHash(current.draftWords) !== snapshotVersion) throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, "\u8349\u7A3F\u5728\u53D1\u5E03\u8FC7\u7A0B\u4E2D\u53D1\u751F\u53D8\u5316\uFF0C\u8BF7\u91CD\u65B0\u53D1\u5E03");
      await transaction.collection(COLLECTIONS.tasks).doc(taskId).update({ data: { status: "published", snapshotVersion, wordCount: words.length, draftWords: command.remove(), publishedAt: now, updatedAt: now } });
    });
    return { taskId, published: true, idempotent: false };
  },
  async withdraw(payload) {
    const user = await ensureUser();
    const taskId = requireString(payload.taskId, "\u4EFB\u52A1 ID");
    const task = await getTask(taskId);
    await requireOwner(String(task.groupId), userIdOf(user));
    if (task.status === "withdrawn") return { taskId, withdrawn: true, idempotent: true };
    if (task.status !== "published") throw new BusinessError(ERROR_CODES.TASK_NOT_PUBLISHED, "\u53EA\u6709\u5DF2\u53D1\u5E03\u4EFB\u52A1\u53EF\u4EE5\u64A4\u56DE");
    await db.collection(COLLECTIONS.tasks).doc(taskId).update({ data: { status: "withdrawn", withdrawnAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() } });
    return { taskId, withdrawn: true, idempotent: false };
  },
  async listByGroup(payload) {
    const user = await ensureUser();
    const groupId = requireString(payload.groupId, "\u5C0F\u7EC4 ID");
    const membership = await getMembership(groupId, userIdOf(user));
    const statuses = membership.role === "owner" ? ["draft", "published", "withdrawn"] : ["published", "withdrawn"];
    const result = await db.collection(COLLECTIONS.tasks).where({ groupId, status: command.in(statuses) }).orderBy("deadline", "asc").limit(LIMITS.pageSize).get();
    return result.data.map((task) => cleanTask(task));
  },
  async getMemberView(payload) {
    const user = await ensureUser();
    const taskId = requireString(payload.taskId, "\u4EFB\u52A1 ID");
    const task = await getTask(taskId);
    await requireMember(String(task.groupId), userIdOf(user));
    if (task.status === "draft") throw new BusinessError(ERROR_CODES.TASK_NOT_PUBLISHED, "\u4EFB\u52A1\u5C1A\u672A\u53D1\u5E03");
    const progressId = relationId(taskId, userIdOf(user));
    const progress = await db.collection(COLLECTIONS.progress).doc(progressId).get().catch(() => null);
    return { task: cleanTask(task), progress: (progress == null ? void 0 : progress.data) ?? null };
  }
};
var statsHandlers = {
  async getOwnerStats(payload) {
    const user = await ensureUser();
    const taskId = requireString(payload.taskId, "\u4EFB\u52A1 ID");
    const task = await getTask(taskId);
    await requireOwner(String(task.groupId), userIdOf(user));
    const memberships = await db.collection(COLLECTIONS.groupMembers).where({ groupId: task.groupId, role: "member", status: "active" }).limit(100).get();
    const rows = await Promise.all(memberships.data.map(async (membership) => {
      const [profileResult, progressResult] = await Promise.all([
        db.collection(COLLECTIONS.users).doc(String(membership.userId)).get().catch(() => null),
        db.collection(COLLECTIONS.progress).doc(relationId(taskId, String(membership.userId))).get().catch(() => null)
      ]);
      const profile = profileResult == null ? void 0 : profileResult.data;
      const progress = progressResult == null ? void 0 : progressResult.data;
      const submissionResult = (progress == null ? void 0 : progress.stage) === "submitted" ? await db.collection(COLLECTIONS.submissions).doc(relationId("formal", taskId, String(membership.userId))).get().catch(() => null) : null;
      const submission = submissionResult == null ? void 0 : submissionResult.data;
      const wrongCount = Array.isArray(submission == null ? void 0 : submission.items) ? submission.items.filter((item) => !item.isCorrect).length : 0;
      return { userId: membership.userId, nickname: (profile == null ? void 0 : profile.nickname) ?? "\u5FAE\u4FE1\u7528\u6237", avatarUrl: (profile == null ? void 0 : profile.avatarUrl) ?? "", stage: (progress == null ? void 0 : progress.stage) ?? "pending", score: (progress == null ? void 0 : progress.score) ?? null, submittedAt: (progress == null ? void 0 : progress.submittedAt) ?? null, timing: (progress == null ? void 0 : progress.timing) ?? null, wrongCount };
    }));
    const completed = rows.filter((row) => row.stage === "submitted");
    return { memberCount: rows.length, completedCount: completed.length, completionRate: rows.length ? Math.round(completed.length / rows.length * 100) : 0, averageScore: completed.length ? Math.round(completed.reduce((sum, row) => sum + Number(row.score), 0) / completed.length) : null, highestScore: completed.length ? Math.max(...completed.map((row) => Number(row.score))) : null, lowestScore: completed.length ? Math.min(...completed.map((row) => Number(row.score))) : null, members: rows };
  },
  async getRanking(payload) {
    const user = await ensureUser();
    const taskId = requireString(payload.taskId, "\u4EFB\u52A1 ID");
    const task = await getTask(taskId);
    await getMembership(String(task.groupId), userIdOf(user));
    const memberships = await db.collection(COLLECTIONS.groupMembers).where({ groupId: task.groupId, role: "member", status: "active" }).limit(100).get();
    const entries = [];
    const unfinished = [];
    for (const membership of memberships.data) {
      const [profileResult, progressResult] = await Promise.all([
        db.collection(COLLECTIONS.users).doc(String(membership.userId)).get().catch(() => null),
        db.collection(COLLECTIONS.progress).doc(relationId(taskId, String(membership.userId))).get().catch(() => null)
      ]);
      const profile = profileResult == null ? void 0 : profileResult.data;
      const progress = progressResult == null ? void 0 : progressResult.data;
      const base = { userId: membership.userId, nickname: (profile == null ? void 0 : profile.nickname) ?? "\u5FAE\u4FE1\u7528\u6237", avatarUrl: (profile == null ? void 0 : profile.avatarUrl) ?? "" };
      if ((progress == null ? void 0 : progress.stage) === "submitted") entries.push({ ...base, score: Number(progress.score), submittedAt: progress.submittedAt, timing: progress.timing });
      else unfinished.push({ ...base, stage: (progress == null ? void 0 : progress.stage) ?? "pending" });
    }
    return { ranking: assignRanks(entries), unfinished };
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

// cloudfunctions/task/src/index.ts
var main = (event) => route(event, { ...taskHandlers, ...statsHandlers });
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  main
});
