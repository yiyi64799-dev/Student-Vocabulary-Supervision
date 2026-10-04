import { api } from '../../services/api';
import { showError } from '../../utils/errors';
import { formatDateTime } from '../../utils/date';
import type { FormalResult } from '../../types/api';
Page({
  data: { state: 'loading' as LoadState, taskId: '', userId: '', submission: null as FormalResult['submission'] | null, items: [] as FormalResult['items'], visibleItems: [] as FormalResult['items'], onlyWrong: false, submittedLabel: '', canPractice: false },
  onLoad(options: Record<string,string>) { this.setData({ taskId: options.taskId ?? '', userId: options.userId ?? '' }); void this.load(); },
  async load() { this.setData({ state: 'loading' }); try { const result = await api.attempt.getResult(this.data.taskId, this.data.userId || undefined); this.setData({ ...result, submittedLabel: formatDateTime(result.submission.submittedAt), visibleItems: this.data.onlyWrong ? result.items.filter((item) => !item.isCorrect) : result.items, canPractice: !this.data.userId && Number(result.submission.correctCount ?? 0) < result.submission.totalCount, state: 'ready' }); } catch(error) { this.setData({ state: 'error' }); showError(error); } },
  toggleWrong() { const onlyWrong = !this.data.onlyWrong; this.setData({ onlyWrong, visibleItems: onlyWrong ? this.data.items.filter((item) => !item.isCorrect) : this.data.items }); },
  practice() { wx.navigateTo({ url: `/pages/wrong-practice/index?taskId=${this.data.taskId}` }); },
});
