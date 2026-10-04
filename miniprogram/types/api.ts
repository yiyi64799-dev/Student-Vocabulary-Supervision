import type {
  GroupDocument,
  GroupMemberDocument,
  MemberTaskProgressDocument,
  RankingEntry,
  SubmissionDocument,
  SubmissionItemDocument,
  TaskDocument,
  TaskWordDocument,
  UserRole,
} from '../../shared/types';

export type CloudDate = string | Date;
export type TaskView = Omit<TaskDocument, 'deadline' | 'publishedAt' | 'withdrawnAt' | 'createdAt' | 'updatedAt'> & {
  deadline: CloudDate | null;
  publishedAt: CloudDate | null;
  withdrawnAt: CloudDate | null;
  createdAt: CloudDate;
  updatedAt: CloudDate;
};

export interface GroupSummary extends Pick<GroupDocument, '_id' | 'name' | 'description' | 'memberCount'> {
  role: UserRole;
  inviteCode?: string;
}

export interface GroupDetail extends Pick<GroupDocument, '_id' | 'name' | 'description' | 'memberCount'> {
  myRole: UserRole;
  inviteCode?: string;
}

export interface GroupMemberView extends Pick<GroupMemberDocument, 'userId' | 'role'> {
  joinedAt: CloudDate;
  nickname: string;
  avatarUrl: string;
  initial?: string;
}

export type ProgressView = Omit<MemberTaskProgressDocument, 'startedAt' | 'memoryDoneAt' | 'submittedAt' | 'updatedAt'> & {
  startedAt: CloudDate | null;
  memoryDoneAt: CloudDate | null;
  submittedAt: CloudDate | null;
  updatedAt: CloudDate;
};

export interface MemberTaskView { task: TaskView; progress: ProgressView | null }
export interface StudyView { task: TaskView; words: TaskWordDocument[]; progress: ProgressView }

export interface OwnerMemberStat {
  userId: string;
  nickname: string;
  avatarUrl: string;
  stage: string;
  score: number | null;
  submittedAt: CloudDate | null;
  timing: 'on_time' | 'overdue' | null;
  wrongCount: number;
}

export interface OwnerStats {
  memberCount: number;
  completedCount: number;
  completionRate: number;
  averageScore: number | null;
  highestScore: number | null;
  lowestScore: number | null;
  members: OwnerMemberStat[];
}

export interface RankingResult {
  ranking: RankingEntry[];
  unfinished: Array<{ userId: string; nickname: string; avatarUrl: string; stage: string }>;
}

export interface FormalStart { submissionId: string; questionOrder: string[]; resumed: boolean }
export interface ScoreResult { score: number; correctCount: number; totalCount: number; timing?: 'on_time' | 'overdue' }
export interface FormalResult {
  submission: Omit<SubmissionDocument, 'submittedAt' | 'startedAt'> & { submittedAt: CloudDate; startedAt: CloudDate };
  items: Array<SubmissionItemDocument & { word: TaskWordDocument }>;
}
export interface PracticeStart { practiceId: string | null; questionOrder: string[]; message?: string }
export interface PracticeResult extends ScoreResult { practiceId: string; idempotent: boolean }

