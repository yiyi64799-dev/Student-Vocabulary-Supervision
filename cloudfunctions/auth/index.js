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

// cloudfunctions/auth/src/index.ts
var index_exports = {};
__export(index_exports, {
  main: () => main
});
module.exports = __toCommonJS(index_exports);

// cloudfunctions/_shared/teacher.ts
var import_node_crypto2 = require("node:crypto");

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
var safeUser = (user) => ({
  _id: user._id,
  accountRole: user.accountRole === "teacher" ? "teacher" : "student",
  nickname: user.nickname,
  avatarUrl: user.avatarUrl,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});
var toPlainDate = (value) => {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate();
  }
  return new Date(value);
};

// cloudfunctions/_shared/teacher.ts
var teacherCodeHash = (code) => (0, import_node_crypto2.createHash)("sha256").update(code.trim().toUpperCase()).digest("hex");
async function activateTeacher(payload) {
  const user = await ensureUser();
  const code = typeof payload.code === "string" ? payload.code.trim().toUpperCase() : "";
  if (!/^[A-F0-9]{32}$/.test(code)) throw new BusinessError(ERROR_CODES.INVALID_TEACHER_CODE, "\u6559\u5E08\u5F00\u901A\u7801\u65E0\u6548\uFF0C\u8BF7\u6838\u5BF9\u7BA1\u7406\u5458\u63D0\u4F9B\u7684\u5F00\u901A\u7801");
  const outcome = await db.runTransaction(async (transaction) => {
    const userRef = transaction.collection(COLLECTIONS.users).doc(String(user._id));
    const current = (await userRef.get()).data;
    if (!current) throw new BusinessError(ERROR_CODES.UNAUTHORIZED, "\u7528\u6237\u6863\u6848\u4E0D\u5B58\u5728\uFF0C\u8BF7\u91CD\u65B0\u8FDB\u5165\u5C0F\u7A0B\u5E8F");
    if (current.accountRole === "teacher") return { user: current };
    const now = /* @__PURE__ */ new Date();
    const windowStart = current.activationWindowAt ? toPlainDate(current.activationWindowAt).getTime() : 0;
    const attempts = now.getTime() - windowStart < 15 * 60 * 1e3 ? Number(current.activationAttempts ?? 0) : 0;
    if (attempts >= 5) return { error: ERROR_CODES.ACTIVATION_RATE_LIMITED };
    const codeRef = transaction.collection(COLLECTIONS.teacherCodes).doc(teacherCodeHash(code));
    const record = (await codeRef.get()).data;
    const expiresAt = (record == null ? void 0 : record.expiresAt) ? toPlainDate(record.expiresAt).getTime() : NaN;
    if (!record || record.status !== "active" || !Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
      await userRef.update({ data: { activationAttempts: attempts + 1, activationWindowAt: attempts ? current.activationWindowAt : now } });
      return { error: ERROR_CODES.INVALID_TEACHER_CODE };
    }
    await codeRef.update({ data: { status: "used", usedBy: user._id, usedAt: now } });
    await userRef.update({ data: { accountRole: "teacher", teacherActivatedAt: now, updatedAt: now, activationAttempts: 0 } });
    return { user: { ...current, accountRole: "teacher", updatedAt: now } };
  });
  if ("error" in outcome) throw new BusinessError(outcome.error ?? ERROR_CODES.INVALID_TEACHER_CODE, outcome.error === ERROR_CODES.ACTIVATION_RATE_LIMITED ? "\u5C1D\u8BD5\u6B21\u6570\u8FC7\u591A\uFF0C\u8BF7 15 \u5206\u949F\u540E\u91CD\u8BD5" : "\u6559\u5E08\u5F00\u901A\u7801\u65E0\u6548\u3001\u5DF2\u4F7F\u7528\u6216\u5DF2\u8FC7\u671F");
  return safeUser(outcome.user);
}

// cloudfunctions/_shared/domain.ts
var userIdOf = (user) => String(user._id);
var authHandlers = {
  activateTeacher,
  async ensureUser(payload) {
    const user = await ensureUser();
    const nickname = typeof payload.nickname === "string" ? payload.nickname.trim().slice(0, 30) : "";
    const avatarUrl = typeof payload.avatarUrl === "string" ? payload.avatarUrl.trim().slice(0, 500) : "";
    if (nickname || avatarUrl) {
      await db.collection(COLLECTIONS.users).doc(String(user._id)).update({ data: { ...nickname ? { nickname } : {}, ...avatarUrl ? { avatarUrl } : {}, updatedAt: /* @__PURE__ */ new Date() } });
      return safeUser({ ...user, ...nickname ? { nickname } : {}, ...avatarUrl ? { avatarUrl } : {}, updatedAt: /* @__PURE__ */ new Date() });
    }
    return safeUser(user);
  },
  async updateProfile(payload) {
    const user = await ensureUser();
    const nickname = requireString(payload.nickname, "\u6635\u79F0").slice(0, 30);
    const avatarUrl = typeof payload.avatarUrl === "string" ? payload.avatarUrl.trim().slice(0, 500) : "";
    const updatedAt = /* @__PURE__ */ new Date();
    await db.collection(COLLECTIONS.users).doc(userIdOf(user)).update({ data: { nickname, avatarUrl, updatedAt } });
    return safeUser({ ...user, nickname, avatarUrl, updatedAt });
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

// cloudfunctions/auth/src/index.ts
var main = (event) => route(event, authHandlers);
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  main
});
