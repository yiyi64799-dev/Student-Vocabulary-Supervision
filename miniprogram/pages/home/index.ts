import { api } from '../../services/api';
import { showError } from '../../utils/errors';
import type { GroupSummary } from '../../types/api';
import { taskDisplay } from '../../utils/task-display';

type LearningCard = ReturnType<typeof taskDisplay> & { groupName: string; actionLabel: string; progressPercent: number; stage: string; wrongCount: number };

Page({
  data: { state: 'loading' as LoadState, groups: [] as GroupSummary[], recentTasks: [] as LearningCard[], allTasks: [] as LearningCard[], visibleTasks: [] as LearningCard[], selectedTab: 'pending', tabs: [{ key: 'pending', label: '待完成' }, { key: 'learning', label: '学习中' }, { key: 'review', label: '错词复习' }], pendingCount: 0, reviewCount: 0, tasksError: false, nickname: '同学', creating: false, joining: false, showCreate: false, showJoin: false, groupName: '', description: '', inviteCode: '' },
  onLoad() { void this.load(); },
  onShow() { if (this.data.state !== 'loading') void this.load(); },
  onPullDownRefresh() { void this.load().finally(() => wx.stopPullDownRefresh()); },
  async load() {
    this.setData({ state: 'loading' });
    try {
      const app = getApp<IAppOption>();
      await app.globalData.ready;
      if (!app.globalData.user) app.globalData.user = await api.auth.ensureUser();
      if (app.globalData.user.accountRole === 'teacher') { wx.redirectTo({ url: '/pages/teacher/index' }); return; }
      const groups = await api.group.listMine();
      const memberGroups = groups.filter((group) => group.role === 'member');
      const results = await Promise.allSettled(memberGroups.map(async (group) => {
        const tasks = await api.task.listByGroup(group._id);
        const candidates = tasks.filter((task) => task.status === 'published');
        const pending = await Promise.all(candidates.map(async (task) => {
          const view = await api.task.getMemberView(task._id);
          const stage = view.progress?.stage ?? 'pending';
          return { ...taskDisplay(task), groupName: group.name, stage, actionLabel: stage === 'submitted' ? '复习错词' : stage === 'ready_for_dictation' ? '开始默写' : stage === 'learning' ? '继续学习' : '开始学习', progressPercent: stage === 'submitted' || stage === 'ready_for_dictation' ? 100 : view.progress && task.wordCount ? Math.round(((view.progress.studyIndex + 1) / task.wordCount) * 100) : 0, wrongCount: stage === 'submitted' ? Math.max(0, (view.progress?.totalCount ?? 0) - (view.progress?.correctCount ?? 0)) : 0 };
        }));
        return pending;
      }));
      const allTasks = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []).sort((left, right) => {
        const leftTime = left.deadline ? new Date(left.deadline).getTime() : Number.POSITIVE_INFINITY;
        const rightTime = right.deadline ? new Date(right.deadline).getTime() : Number.POSITIVE_INFINITY;
        return leftTime - rightTime;
      });
      const pending = allTasks.filter((task) => task.stage !== 'submitted');
      this.setData({ groups, allTasks, recentTasks: pending.slice(0, 3), pendingCount: pending.length, reviewCount: allTasks.filter((task) => task.wrongCount > 0).length, tasksError: results.some((result) => result.status === 'rejected'), nickname: app.globalData.user?.nickname ?? '同学', state: groups.length ? 'ready' : 'empty' });
      this.applyTab();
    } catch (error) { this.setData({ state: 'error' }); showError(error); }
  },
  selectTab(event: WechatMiniprogram.TouchEvent) { this.setData({ selectedTab: String(event.currentTarget.dataset.key) }); this.applyTab(); },
  applyTab() { this.setData({ visibleTasks: this.data.allTasks.filter((task) => this.data.selectedTab === 'review' ? task.wrongCount > 0 : this.data.selectedTab === 'learning' ? ['learning', 'ready_for_dictation'].includes(task.stage) : task.stage !== 'submitted') }); },
  openLearningTask(event: WechatMiniprogram.TouchEvent) { const id = String(event.currentTarget.dataset.id); const task = this.data.allTasks.find((item) => item._id === id); const page = task?.stage === 'submitted' ? 'wrong-practice' : task?.stage === 'ready_for_dictation' ? 'dictation' : 'study'; wx.navigateTo({ url: `/pages/${page}/index?taskId=${encodeURIComponent(id)}` }); },
  showStudyGuide() { wx.showModal({ title: '让单词进入长期记忆', content: '① 先看单词与释义，再遮住释义主动回想。\n② 遇到形近词，比较拼写差异；遇到熟词，留意不同语境中的含义。\n③ 完成记忆后独立默写，提交后查看错因。\n④ 在错词复习中再次回想，练习不会改动正式成绩。', showCancel: false, confirmText: '开始行动' }); },
  toggleJoin() { this.setData({ showJoin: !this.data.showJoin, showCreate: false }); },
  onInviteCode(event: WechatMiniprogram.Input) { this.setData({ inviteCode: event.detail.value.trim().toUpperCase() }); },
  async joinGroup() {
    if (this.data.joining) return;
    this.setData({ joining: true });
    try {
      const result = await api.group.joinByCode(this.data.inviteCode);
      wx.showToast({ title: '加入成功' });
      wx.navigateTo({ url: `/pages/group-detail/index?groupId=${result.groupId}` });
    } catch (error) { showError(error); } finally { this.setData({ joining: false }); }
  },
  openGroup(event: WechatMiniprogram.TouchEvent) { wx.navigateTo({ url: `/pages/group-detail/index?groupId=${event.currentTarget.dataset.id}` }); },
  openTask(event: WechatMiniprogram.TouchEvent) { wx.navigateTo({ url: `/pages/member-task-detail/index?taskId=${event.currentTarget.dataset.id}` }); },
  openGroups() { wx.navigateTo({ url: '/pages/groups/index' }); },
  openProfile() { wx.navigateTo({ url: '/pages/profile/index' }); },
});
