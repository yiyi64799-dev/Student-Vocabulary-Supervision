// Preview-only simulation. Formal grading always runs on the server.
// Keep this module inside miniprogramRoot so WeChat can package it.
export const normalizeAnswer = (value: string): string => value.trim().toLowerCase();
export const calculateScore = (correct: number, total: number): number => total ? Math.round(correct / total * 100) : 0;
export function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other] as T, result[index] as T];
  }
  return result;
}
