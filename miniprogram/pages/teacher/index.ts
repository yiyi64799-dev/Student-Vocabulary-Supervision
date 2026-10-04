import { api } from '../../services/api';
import { showError } from '../../utils/errors';
import { createIdempotencyKey } from '../../utils/idempotency';
import { taskDisplay } from '../../utils/task-display';
import type { GroupSummary } from '../../types/api';

type TeachingTask = ReturnType<typeof taskDisplay> & { groupName: string };
Page({
  data: { state: 'loading' as LoadState, nickname: '老师', groups: [] as GroupSummary[], tasks: [] as TeachingTask[], previewTasks: [] as TeachingTask[], tasksError: false, preview: false, showCreate: false, name: '', description: '', creating: false, createKey: '' },
  onLoad() { void this.load(); },
  onShow() { if (this.data.state !== 'loading') void this.load(); },
  onPullDownRefresh() { void this.load().finally(() => wx.stopPullDownRefresh()); },
  async load() {
    this.setData({ state: 'loading' });
    try {
      const app = getApp<IAppOption>();
      await app.globalData.ready;
      const user = await api.auth.ensureUser();
      app.globalData.user = user;
      if (user.accountRole !== 'teacher') { wx.redirectTo({ url: '/pages/home/index' }); return; }
      const groups = (await api.group.listMine()).filter((group) => group.role === 'owner');
      const results = await Promise.allSettled(groups.map(async (group) => (await api.task.listByGroup(group._id)).map((task) => ({ ...taskDisplay(task), groupName: group.name }))));
      const tasks = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
      this.setData({ nickname: user.nickname, groups, tasks, previewTasks: tasks.filter((task) => task.status === 'published'), tasksError: results.some((result) => result.status === 'rejected'), state: 'ready' });
    } catch (error) { this.setData({ state: 'error' }); showError(error); }
  },
  togglePreview() { this.setData({ preview: !this.data.preview, showCreate: false }); },
  toggleCreate() { this.setData({ showCreate: !this.data.showCreate }); },
  onName(event: WechatMiniprogram.Input) { if (!this.data.creating) this.setData({ name: event.detail.value, createKey: '' }); },
  onDescription(event: WechatMiniprogram.Input) { if (!this.data.creating) this.setData({ description: event.detail.value, createKey: '' }); },
  async createGroup() {
    if (this.data.creating) return;
    this.setData({ creating: true, createKey: this.data.createKey || createIdempotencyKey('group') });
    try {
      const result = await api.group.create(this.data.name, this.data.description, this.data.createKey);
      this.setData({ showCreate: false, name: '', description: '', createKey: '' });
      wx.navigateTo({ url: `/pages/group-detail/index?groupId=${result.groupId}` });
    } catch (error) { showError(error); } finally { this.setData({ creating: false }); }
  },
  openGroup(event: WechatMiniprogram.TouchEvent) { wx.navigateTo({ url: `/pages/group-detail/index?groupId=${event.currentTarget.dataset.id}` }); },
  openTask(event: WechatMiniprogram.TouchEvent) {
    const task = this.data.tasks.find((item) => item._id === event.currentTarget.dataset.id);
    if (!task) return;
    const page = this.data.preview ? 'student-preview' : task.status === 'draft' ? 'task-edit' : 'task-owner-detail';
    wx.navigateTo({ url: `/pages/${page}/index?taskId=${encodeURIComponent(task._id)}` });
  },
  openGroups() { wx.navigateTo({ url: '/pages/groups/index' }); },
  openProfile() { wx.navigateTo({ url: '/pages/profile/index' }); },
});
