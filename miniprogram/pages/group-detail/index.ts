import { api } from '../../services/api';
import { showError } from '../../utils/errors';
import { taskDisplay } from '../../utils/task-display';
import type { GroupDetail, TaskView } from '../../types/api';
import { createIdempotencyKey } from '../../utils/idempotency';

Page({
  data: { state: 'loading' as LoadState, groupId: '', group: null as GroupDetail | null, tasks: [] as ReturnType<typeof taskDisplay>[], visibleTasks: [] as ReturnType<typeof taskDisplay>[], query: '', filter: 'all', filters: [{ key: 'all', label: '全部' }, { key: 'published', label: '进行中' }, { key: 'draft', label: '草稿' }, { key: 'withdrawn', label: '已撤回' }], creatingTask: false },
  onLoad(options: Record<string, string>) { this.setData({ groupId: options.groupId ?? '' }); void this.load(); },
  onShow() { if (this.data.groupId && this.data.state !== 'loading') void this.load(); },
  onPullDownRefresh() { void this.load().finally(() => wx.stopPullDownRefresh()); },
  async load() { this.setData({ state: 'loading' }); try { const [group, tasks] = await Promise.all([api.group.getDetail(this.data.groupId), api.task.listByGroup(this.data.groupId)]); this.setData({ group, tasks: tasks.map(taskDisplay), filters: this.data.filters.filter((item) => group.myRole === 'owner' || item.key !== 'draft'), state: 'ready' }); this.applyFilter(); wx.setNavigationBarTitle({ title: group.name }); } catch (error) { this.setData({ state: 'error' }); showError(error); } },
  onSearch(event: WechatMiniprogram.Input) { this.setData({ query: event.detail.value }); this.applyFilter(); },
  selectFilter(event: WechatMiniprogram.TouchEvent) { this.setData({ filter: String(event.currentTarget.dataset.key) }); this.applyFilter(); },
  applyFilter() { const query = this.data.query.trim().toLowerCase(); this.setData({ visibleTasks: this.data.tasks.filter((task) => (this.data.filter === 'all' || task.status === this.data.filter) && task.title.toLowerCase().includes(query)) }); },
  copyInvite() { if (this.data.group?.inviteCode) wx.setClipboardData({ data: this.data.group.inviteCode }); },
  async regenerateInvite() { const confirm = await wx.showModal({ title: '重新生成邀请码', content: '旧邀请码会立即失效，确定继续吗？' }); if (!confirm.confirm) return; try { const result = await api.group.regenerateInvite(this.data.groupId); this.setData({ 'group.inviteCode': result.inviteCode }); } catch (error) { showError(error); } },
  openMembers() { wx.navigateTo({ url: `/pages/group-members/index?groupId=${this.data.groupId}` }); },
  async createTask() { if (this.data.creatingTask) return; this.setData({ creatingTask: true }); try { const result = await api.task.createDraft(this.data.groupId, '', createIdempotencyKey('task')); wx.navigateTo({ url: `/pages/task-edit/index?taskId=${result.taskId}` }); } catch (error) { showError(error); } finally { this.setData({ creatingTask: false }); } },
  openTask(event: WechatMiniprogram.TouchEvent) { const task = this.data.tasks.find((item) => item._id === event.currentTarget.dataset.id); if (!task || !this.data.group) return; const page = this.data.group.myRole === 'owner' ? (task.status === 'draft' ? 'task-edit' : 'task-owner-detail') : 'member-task-detail'; wx.navigateTo({ url: `/pages/${page}/index?taskId=${task._id}` }); },
});
