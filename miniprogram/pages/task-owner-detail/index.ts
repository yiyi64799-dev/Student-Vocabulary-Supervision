import { api } from '../../services/api';
import { showError } from '../../utils/errors';
import type { OwnerStats, TaskView } from '../../types/api';
Page({
  data: { state: 'loading' as LoadState, taskId: '', task: null as TaskView | null, stats: null as OwnerStats | null, withdrawing: false },
  onLoad(options: Record<string,string>) { this.setData({ taskId: options.taskId ?? '' }); void this.load(); },
  async load() { this.setData({ state: 'loading' }); try { const [task, stats] = await Promise.all([api.task.getOwnerView(this.data.taskId), api.task.getOwnerStats(this.data.taskId)]); this.setData({ task, stats, state: 'ready' }); wx.setNavigationBarTitle({ title: task.title }); } catch(error) { this.setData({ state: 'error' }); showError(error); } },
  async withdraw() { if (this.data.withdrawing || this.data.task?.status === 'withdrawn') return; const modal = await wx.showModal({ title: '撤回任务', content: '撤回后成员不能再开始正式默写，历史成绩仍会保留。确定继续吗？' }); if (!modal.confirm) return; this.setData({ withdrawing: true }); try { await api.task.withdraw(this.data.taskId); wx.showToast({ title: '已撤回' }); await this.load(); } catch(error) { showError(error); } finally { this.setData({ withdrawing: false }); } },
  previewStudent() { wx.navigateTo({ url: `/pages/student-preview/index?taskId=${encodeURIComponent(this.data.taskId)}` }); },
  openRanking() { wx.navigateTo({ url: `/pages/ranking/index?taskId=${this.data.taskId}` }); },
  openResult(event: WechatMiniprogram.TouchEvent) { const userId = event.currentTarget.dataset.userid; if (!userId) return; wx.navigateTo({ url: `/pages/result/index?taskId=${this.data.taskId}&userId=${userId}` }); },
});
