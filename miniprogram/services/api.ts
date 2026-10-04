import { callCloud } from './cloud';
import type { UserProfile, TaskWordDocument, ImportPreview, TaskWordInput } from '../../shared/types';
import type { FormalResult, FormalStart, GroupDetail, GroupMemberView, GroupSummary, MemberTaskView, OwnerStats, PracticeResult, PracticeStart, RankingResult, ScoreResult, StudyView, TaskView } from '../types/api';

export const api = {
  auth: {
    activateTeacher: (code: string) => callCloud<UserProfile>('auth', 'activateTeacher', { code }),
    ensureUser: (profile: Record<string, unknown> = {}) => callCloud<UserProfile>('auth', 'ensureUser', profile),
    updateProfile: (nickname: string, avatarUrl: string) => callCloud('auth', 'updateProfile', { nickname, avatarUrl }),
  },
  group: {
    create: (name: string, description: string, idempotencyKey: string) => callCloud<{ groupId: string; inviteCode: string }>('group', 'create', { name, description, idempotencyKey }),
    joinByCode: (inviteCode: string) => callCloud<{ groupId: string }>('group', 'joinByCode', { inviteCode }),
    listMine: () => callCloud<GroupSummary[]>('group', 'listMine'),
    getDetail: (groupId: string) => callCloud<GroupDetail>('group', 'getDetail', { groupId }),
    listMembers: (groupId: string) => callCloud<GroupMemberView[]>('group', 'listMembers', { groupId }),
    regenerateInvite: (groupId: string) => callCloud<{ inviteCode: string }>('group', 'regenerateInvite', { groupId }),
  },
  task: {
    previewStudent: (taskId: string) => callCloud<{ title: string; words: TaskWordDocument[] }>('task', 'previewStudent', { taskId }),
    getOwnerView: (taskId: string) => callCloud<TaskView>('task', 'getOwnerView', { taskId }),
    createDraft: (groupId: string, title: string, idempotencyKey: string) => callCloud<{ taskId: string }>('task', 'createDraft', { groupId, title, idempotencyKey }),
    updateDraft: (taskId: string, title: string, deadline: string, words: TaskWordInput[]) => callCloud('task', 'updateDraft', { taskId, title, deadline, words }),
    importPreview: (taskId: string, text: string) => callCloud<ImportPreview>('task', 'importPreview', { taskId, text }),
    publish: (taskId: string) => callCloud('task', 'publish', { taskId }),
    withdraw: (taskId: string) => callCloud('task', 'withdraw', { taskId }),
    listByGroup: (groupId: string) => callCloud<TaskView[]>('task', 'listByGroup', { groupId }),
    getMemberView: (taskId: string) => callCloud<MemberTaskView>('task', 'getMemberView', { taskId }),
    getOwnerStats: (taskId: string) => callCloud<OwnerStats>('task', 'getOwnerStats', { taskId }),
    getRanking: (taskId: string) => callCloud<RankingResult>('task', 'getRanking', { taskId }),
  },
  study: {
    startOrResume: (taskId: string) => callCloud<StudyView>('study', 'startOrResume', { taskId }),
    saveStudyIndex: (taskId: string, studyIndex: number) => callCloud('study', 'saveStudyIndex', { taskId, studyIndex }),
    completeMemory: (taskId: string) => callCloud('study', 'completeMemory', { taskId }),
  },
  attempt: {
    startFormal: (taskId: string) => callCloud<FormalStart>('attempt', 'startFormal', { taskId }),
    submitFormal: (taskId: string, answers: Record<string, string>) => callCloud<ScoreResult>('attempt', 'submitFormal', { taskId, answers }),
    getResult: (taskId: string, userId?: string) => callCloud<FormalResult>('attempt', 'getResult', { taskId, ...(userId ? { userId } : {}) }),
    startWrongPractice: (taskId: string) => callCloud<PracticeStart>('attempt', 'startWrongPractice', { taskId }),
    submitWrongPractice: (practiceId: string, answers: Record<string, string>) => callCloud<PracticeResult>('attempt', 'submitWrongPractice', { practiceId, answers }),
  },
};
