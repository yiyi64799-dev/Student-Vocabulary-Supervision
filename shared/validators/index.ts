import { LIMITS } from '../constants';
import { normalizeAnswer } from '../core';
import type { TaskWordInput } from '../types';

export const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export const validateGroupInput = (name: unknown, description: unknown): string[] => {
  const errors: string[] = [];
  if (!isNonEmptyString(name) || name.trim().length < LIMITS.groupNameMin || name.trim().length > LIMITS.groupNameMax) {
    errors.push(`小组名称需为 ${LIMITS.groupNameMin}-${LIMITS.groupNameMax} 个字符`);
  }
  if (typeof description !== 'string' || description.trim().length > LIMITS.groupDescriptionMax) {
    errors.push(`小组简介不能超过 ${LIMITS.groupDescriptionMax} 个字符`);
  }
  return errors;
};

export const validateTaskWords = (value: unknown): { words: TaskWordInput[]; errors: string[] } => {
  if (!Array.isArray(value)) return { words: [], errors: ['单词列表格式无效'] };
  if (value.length === 0) return { words: [], errors: ['至少需要 1 个单词'] };
  if (value.length > LIMITS.maxWordsPerTask) return { words: [], errors: [`单个任务不能超过 ${LIMITS.maxWordsPerTask} 个单词`] };
  const words: TaskWordInput[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  value.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      errors.push(`第 ${index + 1} 行格式无效`);
      return;
    }
    const record = item as Record<string, unknown>;
    const word = typeof record.word === 'string' ? record.word.trim() : '';
    const meaning = typeof record.meaning === 'string' ? record.meaning.trim() : '';
    if (!word || !meaning || word.length > LIMITS.wordMax || meaning.length > LIMITS.meaningMax) {
      errors.push(`第 ${index + 1} 行的单词或释义无效`);
      return;
    }
    const key = normalizeAnswer(word);
    if (seen.has(key)) {
      errors.push(`第 ${index + 1} 行与任务内其他单词重复`);
      return;
    }
    seen.add(key);
    words.push({
      word,
      meaning,
      phonetic: typeof record.phonetic === 'string' ? record.phonetic.trim() : '',
      example: typeof record.example === 'string' ? record.example.trim() : '',
    });
  });
  return { words, errors };
};

