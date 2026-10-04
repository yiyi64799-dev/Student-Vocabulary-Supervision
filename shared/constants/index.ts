export const COLLECTIONS = {
  users: 'users',
  teacherCodes: 'teacher_activation_codes',
  groups: 'groups',
  groupMembers: 'group_members',
  tasks: 'tasks',
  taskWords: 'task_words',
  progress: 'member_task_progress',
  submissions: 'submissions',
  submissionItems: 'submission_items',
  wrongWordPractices: 'wrong_word_practices',
  wrongWordStats: 'wrong_word_stats',
} as const;

export const LIMITS = {
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
  pageSize: 20,
} as const;

export const ERROR_CODES = {
  TEACHER_REQUIRED: 'TEACHER_REQUIRED',
  INVALID_TEACHER_CODE: 'INVALID_TEACHER_CODE',
  ACTIVATION_RATE_LIMITED: 'ACTIVATION_RATE_LIMITED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  GROUP_NOT_FOUND: 'GROUP_NOT_FOUND',
  INVALID_INVITE_CODE: 'INVALID_INVITE_CODE',
  ALREADY_IN_GROUP: 'ALREADY_IN_GROUP',
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  TASK_NOT_PUBLISHED: 'TASK_NOT_PUBLISHED',
  TASK_WITHDRAWN: 'TASK_WITHDRAWN',
  MEMORY_NOT_COMPLETED: 'MEMORY_NOT_COMPLETED',
  FORMAL_ALREADY_SUBMITTED: 'FORMAL_ALREADY_SUBMITTED',
  SUBMISSION_NOT_FOUND: 'SUBMISSION_NOT_FOUND',
  TOO_MANY_WORDS: 'TOO_MANY_WORDS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
