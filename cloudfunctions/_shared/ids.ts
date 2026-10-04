import { createHash, randomBytes } from 'node:crypto';

export const relationId = (...parts: string[]): string =>
  createHash('sha256').update(parts.join(':')).digest('hex').slice(0, 48);

export const stableHash = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 20);

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const generateInviteCode = (): string => {
  const bytes = randomBytes(6);
  return Array.from(bytes, (value) => INVITE_ALPHABET[value % INVITE_ALPHABET.length]).join('');
};
