export const createIdempotencyKey = (scope: string): string =>
  `${scope}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

