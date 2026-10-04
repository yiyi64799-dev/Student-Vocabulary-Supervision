import { api } from '../../services/api';
import { showError } from '../../utils/errors';
import type { ProgressView, TaskView } from '../../types/api';
Page({
  data: { state: 'loading' as LoadState, taskId: '', task: null as TaskView | null, progress: null as ProgressView | null, isSubmitted: false, isWithdrawn: false, isReadyForDictation: false, studyButtonText: '开始记忆单词' },
  onLoad(options: Record<string,string>) { this.setData({ taskId: options.taskId ?? '' }); void this.load(); },
  onShow() { if (this.data.taskId && this.data.state !== 'loading') void this.load(); },
  async load() { try { const result = await api.task.getMemberView(this.data.taskId); const stage = result.progress?.stage; this.setData({ ...result, isSubmitted: stage === 'submitted', isWithdrawn: result.task.status === 'withdrawn', isReadyForDictation: stage === 'ready_for_dictation', studyButtonText: result.progress ? '继续记忆单词' : '开始记忆单词', state: 'ready' }); wx.setNavigationBarTitle({ title: result.task.title }); } catch(error) { this.setData({ state: 'error' }); showError(error); } },
  startStudy() { wx.navigateTo({ url: `/pages/study/index?taskId=${this.data.taskId}` }); },
  startDictation() { wx.navigateTo({ url: `/pages/dictation/index?taskId=${this.data.taskId}` }); },
  openResult() { wx.navigateTo({ url: `/pages/result/index?taskId=${this.data.taskId}` }); },
  openRanking() { wx.navigateTo({ url: `/pages/ranking/index?taskId=${this.data.taskId}` }); },
});
