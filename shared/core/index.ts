import type { RankingEntry, SubmissionTiming, TaskWordInput } from '../types';

export const normalizeAnswer = (value: string): string => value.trim().toLowerCase();

export const calculateScore = (correctCount: number, totalCount: number): number =>
  totalCount <= 0 ? 0 : Math.round((correctCount / totalCount) * 100);

export const getSubmissionTiming = (submittedAt: Date, deadline: Date): SubmissionTiming =>
  submittedAt.getTime() > deadline.getTime() ? 'overdue' : 'on_time';

export const shuffle = <T>(items: readonly T[], random: () => number = Math.random): T[] => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex] as T, result[index] as T];
  }
  return result;
};

export const assignRanks = <T extends Omit<RankingEntry, 'rank'>>(rows: T[]): Array<T & { rank: number }> => {
  const sorted = [...rows].sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return new Date(left.submittedAt).getTime() - new Date(right.submittedAt).getTime();
  });
  let currentRank = 1;
  return sorted.map((row, index) => {
    const previous = sorted[index - 1];
    const isTie = previous
      && previous.score === row.score
      && new Date(previous.submittedAt).getTime() === new Date(row.submittedAt).getTime();
    if (!isTie) currentRank = index + 1;
    return { ...row, rank: currentRank };
  });
};

const splitLine = (line: string): string[] => {
  if (line.includes('\t')) return line.split('\t');
  if (line.includes('|')) return line.split('|');
  if (line.includes('，')) return line.split('，');
  return line.split(',');
};

export const parseWordImport = (text: string, limits = { wordMax: 60, meaningMax: 200 }) => {
  const validRows: TaskWordInput[] = [];
  const issues: Array<{ line: number; raw: string; code: string; message: string }> = [];
  const seen = new Set<string>();
  let duplicateCount = 0;
  text.split(/\r?\n/).forEach((raw, offset) => {
    if (!raw.trim()) return;
    const [wordValue = '', meaningValue = '', phonetic = '', example = ''] = splitLine(raw);
    const word = wordValue.trim();
    const meaning = meaningValue.trim();
    const line = offset + 1;
    if (!word || !meaning) {
      issues.push({ line, raw, code: !word ? 'MISSING_WORD' : 'MISSING_MEANING', message: !word ? '缺少单词' : '缺少释义' });
      return;
    }
    if (word.length > limits.wordMax || meaning.length > limits.meaningMax) {
      issues.push({ line, raw, code: word.length > limits.wordMax ? 'WORD_TOO_LONG' : 'MEANING_TOO_LONG', message: '字段长度超过限制' });
      return;
    }
    const key = normalizeAnswer(word);
    if (seen.has(key)) {
      duplicateCount += 1;
      issues.push({ line, raw, code: 'DUPLICATE', message: '任务内重复单词，已保留首次出现' });
      return;
    }
    seen.add(key);
    validRows.push({ word, meaning, phonetic: phonetic.trim(), example: example.trim() });
  });
  return {
    validRows,
    issues,
    validCount: validRows.length,
    errorCount: issues.filter((issue) => issue.code !== 'DUPLICATE').length,
    duplicateCount,
  };
};
