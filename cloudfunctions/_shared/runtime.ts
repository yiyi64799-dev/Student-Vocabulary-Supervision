import cloud from 'wx-server-sdk';
import { COLLECTIONS, ERROR_CODES, type ErrorCode } from '../../shared/constants';
import type { ApiResponse } from '../../shared/types';
import { relationId } from './ids';

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

export const db = cloud.database({ throwOnNotFound: false });
export const command = db.command;

export interface DocumentRef {
  get(): Promise<{ data: Record<string, unknown> | null }>;
  set(options: { data: Record<string, unknown> }): Promise<unknown>;
  update(options: { data: Record<string, unknown> }): Promise<unknown>;
}
export interface IdentityTransaction { collection(name: string): { doc(id: string): DocumentRef } }

export class BusinessError extends Error {
  constructor(public readonly code: ErrorCode | string, message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = 'BusinessError';
  }
}

export const ok = <T>(data: T): ApiResponse<T> => ({ success: true, data });

export const fail = (error: unknown): ApiResponse<never> => {
  if (error instanceof BusinessError) {
    return { success: false, error: { code: error.code, message: error.message, details: error.details } };
  }
  console.error('Unhandled cloud function error', error);
  return { success: false, error: { code: ERROR_CODES.INTERNAL_ERROR, message: '服务暂时不可用，请稍后重试' } };
};

export const requireString = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, `${label}不能为空`);
  }
  return value.trim();
};

export const parseDate = (value: unknown, label = '时间'): Date => {
  const date = value instanceof Date ? value : new Date(typeof value === 'string' || typeof value === 'number' ? value : '');
  if (Number.isNaN(date.getTime())) throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, `${label}格式无效`);
  return date;
};

export const getOpenId = (): string => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) throw new BusinessError(ERROR_CODES.UNAUTHORIZED, '无法获取登录身份');
  return OPENID;
};

export const ensureUser = async (): Promise<Record<string, unknown>> => {
  const openid = getOpenId();
  const userId = relationId('user', openid);
  const result = await db.collection(COLLECTIONS.users).doc(userId).get();
  const existing = result?.data as Record<string, unknown> | undefined;
  if (existing) return existing;
  // Create atomically: a concurrent initialization must never overwrite an activated role.
  return db.runTransaction(async (transaction: IdentityTransaction) => {
    const ref = transaction.collection(COLLECTIONS.users).doc(userId);
    const current = await ref.get();
    if (current.data) return current.data as Record<string, unknown>;
    const now = new Date();
    const data = { openid, nickname: '微信用户', avatarUrl: '', accountRole: 'student', createdAt: now, updatedAt: now };
    await ref.set({ data });
    return { _id: userId, ...data };
  });
};


export const safeUser = (user: Record<string, unknown>) => ({
  _id: user._id,
  accountRole: user.accountRole === 'teacher' ? 'teacher' as const : 'student' as const,
  nickname: user.nickname,
  avatarUrl: user.avatarUrl,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const getMembership = async (groupId: string, userId: string): Promise<Record<string, unknown>> => {
  const result = await db.collection(COLLECTIONS.groupMembers).doc(relationId(groupId, userId)).get().catch(() => null);
  const member = result?.data as Record<string, unknown> | undefined;
  if (!member || member.status !== 'active') throw new BusinessError(ERROR_CODES.FORBIDDEN, '你不是该小组的有效成员');
  return member;
};

export const requireMember = async (groupId: string, userId: string): Promise<Record<string, unknown>> => {
  const membership = await getMembership(groupId, userId);
  if (membership.role !== 'member') throw new BusinessError(ERROR_CODES.FORBIDDEN, 'Owner 不参与本组学习任务');
  return membership;
};

export const requireOwner = async (groupId: string, userId: string): Promise<Record<string, unknown>> => {
  const groupResult = await db.collection(COLLECTIONS.groups).doc(groupId).get().catch(() => null);
  const group = groupResult?.data as Record<string, unknown> | undefined;
  if (!group) throw new BusinessError(ERROR_CODES.GROUP_NOT_FOUND, '小组不存在');
  if (group.ownerId !== userId) throw new BusinessError(ERROR_CODES.FORBIDDEN, '仅小组 Owner 可执行此操作');
  return group;
};

export const getTask = async (taskId: string): Promise<Record<string, unknown>> => {
  const result = await db.collection(COLLECTIONS.tasks).doc(taskId).get().catch(() => null);
  const task = result?.data as Record<string, unknown> | undefined;
  if (!task) throw new BusinessError(ERROR_CODES.TASK_NOT_FOUND, '任务不存在');
  return task;
};

export const assertPublishedTask = (task: Record<string, unknown>): void => {
  if (task.status === 'withdrawn') throw new BusinessError(ERROR_CODES.TASK_WITHDRAWN, '任务已撤回');
  if (task.status !== 'published') throw new BusinessError(ERROR_CODES.TASK_NOT_PUBLISHED, '任务尚未发布');
};

export const toPlainDate = (value: unknown): Date => {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date(value as string | number);
};
