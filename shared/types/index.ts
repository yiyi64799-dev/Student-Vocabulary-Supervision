export type AccountRole = 'student' | 'teacher';
export interface UserProfile { _id: string; nickname: string; avatarUrl: string; accountRole: AccountRole }

export type UserRole = 'owner' | 'member';
export type MemberStatus = 'active' | 'inactive';
export type TaskStatus = 'draft' | 'published' | 'withdrawn';
export type ProgressStage = 'pending' | 'learning' | 'ready_for_dictation' | 'submitted';
export type SubmissionTiming = 'on_time' | 'overdue';
export type PracticeStatus = 'practicing' | 'completed';

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type ApiResponse<T> =
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: ApiError };

export interface UserDocument {
  _id: string;
  openid: string;
  accountRole: AccountRole;
  teacherActivatedAt?: Date;
  activationAttempts?: number;
  activationWindowAt?: Date;
  nickname: string;
  avatarUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeacherActivationCodeDocument {
  _id: string;
  status: 'active' | 'used' | 'revoked';
  expiresAt: Date;
  usedBy?: string;
  usedAt?: Date;
}

export interface GroupDocument {
  _id: string;
  name: string;
  description: string;
  ownerId: string;
  inviteCode: string;
  inviteVersion: number;
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupMemberDocument {
  _id: string;
  groupId: string;
  userId: string;
  role: UserRole;
  status: MemberStatus;
  joinedAt: Date;
  updatedAt: Date;
}

export interface TaskWordInput {
  word: string;
  meaning: string;
  phonetic?: string;
  example?: string;
}

export interface TaskWordDocument extends TaskWordInput {
  _id: string;
  taskId: string;
  snapshotVersion: string;
  index: number;
  normalizedWord: string;
  createdAt: Date;
}

export interface TaskDocument {
  _id: string;
  groupId: string;
  ownerId: string;
  title: string;
  deadline: Date | null;
  status: TaskStatus;
  wordCount: number;
  snapshotVersion?: string;
  draftWords: TaskWordInput[];
  publishedAt: Date | null;
  withdrawnAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemberTaskProgressDocument {
  _id: string;
  taskId: string;
  groupId: string;
  userId: string;
  stage: ProgressStage;
  studyIndex: number;
  startedAt: Date | null;
  memoryDoneAt: Date | null;
  submittedAt: Date | null;
  score: number | null;
  correctCount: number | null;
  totalCount: number;
  timing: SubmissionTiming | null;
  updatedAt: Date;
}

export interface SubmissionDocument {
  _id: string;
  taskId: string;
  groupId: string;
  userId: string;
  questionOrder: string[];
  status: 'in_progress' | 'submitted';
  startedAt: Date;
  submittedAt: Date | null;
  score: number | null;
  correctCount: number | null;
  totalCount: number;
  timing: SubmissionTiming | null;
  items?: Array<Pick<SubmissionItemDocument, 'wordId' | 'answer' | 'normalizedAnswer' | 'isCorrect'>>;
}

export interface SubmissionItemDocument {
  _id: string;
  submissionId: string;
  taskId: string;
  userId: string;
  wordId: string;
  answer: string;
  normalizedAnswer: string;
  isCorrect: boolean;
  createdAt: Date;
}

export interface WrongWordPracticeDocument {
  _id: string;
  taskId: string;
  submissionId: string;
  userId: string;
  questionOrder: string[];
  answers: Record<string, string>;
  status: PracticeStatus;
  correctCount: number | null;
  totalCount: number;
  score: number | null;
  startedAt: Date;
  submittedAt: Date | null;
}

export interface RankingEntry {
  rank: number;
  userId: string;
  nickname: string;
  avatarUrl: string;
  score: number;
  submittedAt: Date | string;
  timing: SubmissionTiming;
}

export interface ImportIssue {
  line: number;
  raw: string;
  code: 'INVALID_FORMAT' | 'MISSING_WORD' | 'MISSING_MEANING' | 'WORD_TOO_LONG' | 'MEANING_TOO_LONG' | 'DUPLICATE';
  message: string;
}

export interface ImportPreview {
  validRows: TaskWordInput[];
  issues: ImportIssue[];
  validCount: number;
  errorCount: number;
  duplicateCount: number;
}

export interface CloudActionEvent<T = Record<string, unknown>> {
  action: string;
  payload?: T;
}
