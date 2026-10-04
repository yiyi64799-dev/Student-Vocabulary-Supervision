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

// cloudfunctions/group/src/index.ts
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
var INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
var generateInviteCode = () => {
  const bytes = (0, import_node_crypto.randomBytes)(6);
  return Array.from(bytes, (value) => INVITE_ALPHABET[value % INVITE_ALPHABET.length]).join("");
};

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
var requireOwner = async (groupId, userId) => {
  const groupResult = await db.collection(COLLECTIONS.groups).doc(groupId).get().catch(() => null);
  const group = groupResult == null ? void 0 : groupResult.data;
  if (!group) throw new BusinessError(ERROR_CODES.GROUP_NOT_FOUND, "\u5C0F\u7EC4\u4E0D\u5B58\u5728");
  if (group.ownerId !== userId) throw new BusinessError(ERROR_CODES.FORBIDDEN, "\u4EC5\u5C0F\u7EC4 Owner \u53EF\u6267\u884C\u6B64\u64CD\u4F5C");
  return group;
};

// shared/validators/index.ts
var isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
var validateGroupInput = (name, description) => {
  const errors = [];
  if (!isNonEmptyString(name) || name.trim().length < LIMITS.groupNameMin || name.trim().length > LIMITS.groupNameMax) {
    errors.push(`\u5C0F\u7EC4\u540D\u79F0\u9700\u4E3A ${LIMITS.groupNameMin}-${LIMITS.groupNameMax} \u4E2A\u5B57\u7B26`);
  }
  if (typeof description !== "string" || description.trim().length > LIMITS.groupDescriptionMax) {
    errors.push(`\u5C0F\u7EC4\u7B80\u4ECB\u4E0D\u80FD\u8D85\u8FC7 ${LIMITS.groupDescriptionMax} \u4E2A\u5B57\u7B26`);
  }
  return errors;
};

// cloudfunctions/_shared/domain.ts
var userIdOf = (user) => String(user._id);
var uniqueInviteCode = async () => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateInviteCode();
    const match = await db.collection(COLLECTIONS.groups).where({ inviteCode: code }).limit(1).get();
    if (match.data.length === 0) return code;
  }
  throw new BusinessError(ERROR_CODES.INTERNAL_ERROR, "\u9080\u8BF7\u7801\u751F\u6210\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5");
};
var groupHandlers = {
  async create(payload) {
    const user = await ensureUser();
    if (user.accountRole !== "teacher") throw new BusinessError(ERROR_CODES.TEACHER_REQUIRED, "\u8BF7\u5148\u5728\u4E2A\u4EBA\u8D44\u6599\u4E2D\u5F00\u901A\u6559\u5E08\u8EAB\u4EFD");
    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    const description = typeof payload.description === "string" ? payload.description.trim() : "";
    const errors = validateGroupInput(name, description);
    if (errors.length) throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, errors[0], { errors });
    const idempotencyKey = requireString(payload.idempotencyKey, "\u5E42\u7B49\u952E").slice(0, 100);
    const groupId = relationId("group-create", userIdOf(user), idempotencyKey);
    const existing = await db.collection(COLLECTIONS.groups).doc(groupId).get().catch(() => null);
    if (existing == null ? void 0 : existing.data) {
      const group = existing.data;
      if (group.ownerId !== userIdOf(user)) throw new BusinessError(ERROR_CODES.FORBIDDEN, "\u5E42\u7B49\u952E\u51B2\u7A81");
      return { groupId, inviteCode: group.inviteCode, idempotent: true };
    }
    const inviteCode = await uniqueInviteCode();
    return db.runTransaction(async (transaction) => {
      const now = /* @__PURE__ */ new Date();
      const locked = await transaction.collection(COLLECTIONS.groups).doc(groupId).get().catch(() => null);
      if (locked == null ? void 0 : locked.data) {
        const group = locked.data;
        return { groupId, inviteCode: group.inviteCode, idempotent: true };
      }
      await transaction.collection(COLLECTIONS.groups).doc(groupId).set({ data: { name, description, ownerId: userIdOf(user), inviteCode, inviteVersion: 1, memberCount: 0, createdAt: now, updatedAt: now } });
      const membershipId = relationId(groupId, userIdOf(user));
      await transaction.collection(COLLECTIONS.groupMembers).doc(membershipId).set({ data: { groupId, userId: userIdOf(user), role: "owner", status: "active", joinedAt: now, updatedAt: now } });
      return { groupId, inviteCode, idempotent: false };
    });
  },
  async joinByCode(payload) {
    const user = await ensureUser();
    const inviteCode = requireString(payload.inviteCode, "\u9080\u8BF7\u7801").toUpperCase();
    const groups = await db.collection(COLLECTIONS.groups).where({ inviteCode }).limit(1).get();
    const group = groups.data[0];
    if (!group) throw new BusinessError(ERROR_CODES.INVALID_INVITE_CODE, "\u9080\u8BF7\u7801\u65E0\u6548\u6216\u5DF2\u5931\u6548");
    if (group.ownerId === userIdOf(user)) throw new BusinessError(ERROR_CODES.ALREADY_IN_GROUP, "\u4F60\u5DF2\u662F\u8BE5\u5C0F\u7EC4\u7684 Owner");
    const membershipId = relationId(String(group._id), userIdOf(user));
    const existing = await db.collection(COLLECTIONS.groupMembers).doc(membershipId).get().catch(() => null);
    if ((existing == null ? void 0 : existing.data) && existing.data.status === "active") throw new BusinessError(ERROR_CODES.ALREADY_IN_GROUP, "\u4F60\u5DF2\u5728\u8BE5\u5C0F\u7EC4\u4E2D");
    await db.runTransaction(async (transaction) => {
      const now = /* @__PURE__ */ new Date();
      const current = await transaction.collection(COLLECTIONS.groupMembers).doc(membershipId).get().catch(() => null);
      if ((current == null ? void 0 : current.data) && current.data.status === "active") throw new BusinessError(ERROR_CODES.ALREADY_IN_GROUP, "\u4F60\u5DF2\u5728\u8BE5\u5C0F\u7EC4\u4E2D");
      await transaction.collection(COLLECTIONS.groupMembers).doc(membershipId).set({ data: { groupId: group._id, userId: userIdOf(user), role: "member", status: "active", joinedAt: now, updatedAt: now } });
      await transaction.collection(COLLECTIONS.groups).doc(String(group._id)).update({ data: { memberCount: command.inc(1), updatedAt: now } });
    });
    return { groupId: group._id, joined: true };
  },
  async listMine() {
    const user = await ensureUser();
    const memberships = await db.collection(COLLECTIONS.groupMembers).where({ userId: userIdOf(user), status: "active" }).limit(100).get();
    const groups = await Promise.all(memberships.data.map(async (membership) => {
      const result = await db.collection(COLLECTIONS.groups).doc(String(membership.groupId)).get().catch(() => null);
      const group = result == null ? void 0 : result.data;
      return group ? { _id: group._id, name: group.name, description: group.description, memberCount: group.memberCount, role: membership.role, inviteCode: membership.role === "owner" ? group.inviteCode : void 0 } : null;
    }));
    return groups.filter(Boolean);
  },
  async getDetail(payload) {
    const user = await ensureUser();
    const groupId = requireString(payload.groupId, "\u5C0F\u7EC4 ID");
    const membership = await getMembership(groupId, userIdOf(user));
    const result = await db.collection(COLLECTIONS.groups).doc(groupId).get().catch(() => null);
    const group = result == null ? void 0 : result.data;
    if (!group) throw new BusinessError(ERROR_CODES.GROUP_NOT_FOUND, "\u5C0F\u7EC4\u4E0D\u5B58\u5728");
    return { _id: group._id, name: group.name, description: group.description, memberCount: group.memberCount, myRole: membership.role, inviteCode: membership.role === "owner" ? group.inviteCode : void 0 };
  },
  async listMembers(payload) {
    const user = await ensureUser();
    const groupId = requireString(payload.groupId, "\u5C0F\u7EC4 ID");
    await getMembership(groupId, userIdOf(user));
    const members = await db.collection(COLLECTIONS.groupMembers).where({ groupId, status: "active" }).limit(100).get();
    return Promise.all(members.data.map(async (membership) => {
      const result = await db.collection(COLLECTIONS.users).doc(String(membership.userId)).get().catch(() => null);
      const profile = result == null ? void 0 : result.data;
      return { userId: membership.userId, role: membership.role, joinedAt: membership.joinedAt, nickname: (profile == null ? void 0 : profile.nickname) ?? "\u5FAE\u4FE1\u7528\u6237", avatarUrl: (profile == null ? void 0 : profile.avatarUrl) ?? "" };
    }));
  },
  async regenerateInvite(payload) {
    const user = await ensureUser();
    const groupId = requireString(payload.groupId, "\u5C0F\u7EC4 ID");
    const group = await requireOwner(groupId, userIdOf(user));
    const inviteCode = await uniqueInviteCode();
    await db.collection(COLLECTIONS.groups).doc(groupId).update({ data: { inviteCode, inviteVersion: Number(group.inviteVersion ?? 1) + 1, updatedAt: /* @__PURE__ */ new Date() } });
    return { inviteCode };
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

// cloudfunctions/group/src/index.ts
var main = (event) => route(event, groupHandlers);
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  main
});
