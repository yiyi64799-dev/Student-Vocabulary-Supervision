import { api } from '../../services/api';
import { showError } from '../../utils/errors';
import type { TaskWordDocument } from '../../../shared/types';
Page({
  data: { state: 'loading' as LoadState, taskId: '', words: [] as TaskWordDocument[], index: 0, percent: 0, completing: false, hasNextWord: false },
  onLoad(options: Record<string,string>) { this.setData({ taskId: options.taskId ?? '' }); void this.load(); },
  async load() { try { const result = await api.study.startOrResume(this.data.taskId); const index = Math.min(Number(result.progress.studyIndex ?? 0), result.words.length - 1); this.setData({ words: result.words, index, hasNextWord: index < result.words.length - 1, percent: result.words.length ? Math.round(((index + 1) / result.words.length) * 100) : 0, state: 'ready' }); } catch(error) { this.setData({ state: 'error' }); showError(error); } },
  async move(offset: number) { const index = Math.max(0, Math.min(this.data.words.length - 1, this.data.index + offset)); this.setData({ index, hasNextWord: index < this.data.words.length - 1, percent: Math.round(((index + 1) / this.data.words.length) * 100) }); try { await api.study.saveStudyIndex(this.data.taskId, index); } catch(error) { showError(error); } },
  previous() { void this.move(-1); }, next() { void this.move(1); },
  async complete() { if (this.data.completing) return; this.setData({ completing: true }); try { await api.study.completeMemory(this.data.taskId); wx.redirectTo({ url: `/pages/dictation/index?taskId=${this.data.taskId}` }); } catch(error) { showError(error); } finally { this.setData({ completing: false }); } },
});
