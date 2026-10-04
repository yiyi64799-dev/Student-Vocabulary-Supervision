import { createHash } from 'node:crypto';
import { COLLECTIONS, ERROR_CODES } from '../../shared/constants';
import { BusinessError, db, ensureUser, safeUser, toPlainDate, type IdentityTransaction } from './runtime';

export const teacherCodeHash = (code: string): string => createHash('sha256').update(code.trim().toUpperCase()).digest('hex');

export async function activateTeacher(payload: Record<string, unknown>) {
  const user = await ensureUser();
  const code = typeof payload.code === 'string' ? payload.code.trim().toUpperCase() : '';
  if (!/^[A-F0-9]{32}$/.test(code)) throw new BusinessError(ERROR_CODES.INVALID_TEACHER_CODE, '教师开通码无效，请核对管理员提供的开通码');
  const outcome = await db.runTransaction(async (transaction: IdentityTransaction) => {
    const userRef = transaction.collection(COLLECTIONS.users).doc(String(user._id));
    const current = (await userRef.get()).data;
    if (!current) throw new BusinessError(ERROR_CODES.UNAUTHORIZED, '用户档案不存在，请重新进入小程序');
    if (current.accountRole === 'teacher') return { user: current };
    const now = new Date();
    const windowStart = current.activationWindowAt ? toPlainDate(current.activationWindowAt).getTime() : 0;
    const attempts = now.getTime() - windowStart < 15 * 60 * 1000 ? Number(current.activationAttempts ?? 0) : 0;
    if (attempts >= 5) return { error: ERROR_CODES.ACTIVATION_RATE_LIMITED };
    const codeRef = transaction.collection(COLLECTIONS.teacherCodes).doc(teacherCodeHash(code));
    const record = (await codeRef.get()).data as Record<string, unknown> | null;
    const expiresAt = record?.expiresAt ? toPlainDate(record.expiresAt).getTime() : NaN;
    if (!record || record.status !== 'active' || !Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
      // Commit the failed attempt before returning an error; throwing here would roll it back.
      await userRef.update({ data: { activationAttempts: attempts + 1, activationWindowAt: attempts ? current.activationWindowAt : now } });
      return { error: ERROR_CODES.INVALID_TEACHER_CODE };
    }
    await codeRef.update({ data: { status: 'used', usedBy: user._id, usedAt: now } });
    await userRef.update({ data: { accountRole: 'teacher', teacherActivatedAt: now, updatedAt: now, activationAttempts: 0 } });
    return { user: { ...current, accountRole: 'teacher', updatedAt: now } };
  });
  if ('error' in outcome) throw new BusinessError(outcome.error ?? ERROR_CODES.INVALID_TEACHER_CODE, outcome.error === ERROR_CODES.ACTIVATION_RATE_LIMITED ? '尝试次数过多，请 15 分钟后重试' : '教师开通码无效、已使用或已过期');
  return safeUser(outcome.user);
}
