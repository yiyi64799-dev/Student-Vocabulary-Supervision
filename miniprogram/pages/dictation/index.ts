import { api } from '../../services/api';
import { showError } from '../../utils/errors';
import type { TaskWordDocument } from '../../../shared/types';
Page({
  data: { state: 'loading' as LoadState, taskId: '', order: [] as string[], wordsById: {} as Record<string, TaskWordDocument>, index: 0, answers: {} as Record<string,string>, submitting: false, percent: 0 },
  onLoad(options: Record<string,string>) { this.setData({ taskId: options.taskId ?? '' }); void this.load(); },
  async load() { try { const study = await api.study.startOrResume(this.data.taskId); const formal = await api.attempt.startFormal(this.data.taskId); const wordsById = Object.fromEntries(study.words.map((word) => [word._id, word])); const cached = wx.getStorageSync(`dictation:${this.data.taskId}`) as unknown; const answers = cached && typeof cached === 'object' ? cached as Record<string, string> : {}; this.setData({ order: formal.questionOrder, wordsById, answers, state: 'ready', percent: formal.questionOrder.length ? Math.round(100 / formal.questionOrder.length) : 0 }); } catch(error) { this.setData({ state: 'error' }); showError(error); } },
  onAnswer(event: WechatMiniprogram.Input) { const wordId = this.data.order[this.data.index]!; const answers = { ...this.data.answers, [wordId]: event.detail.value }; this.setData({ answers }); wx.setStorageSync(`dictation:${this.data.taskId}`, answers); },
  move(offset: number) { const index = Math.max(0, Math.min(this.data.order.length - 1, this.data.index + offset)); this.setData({ index, percent: Math.round(((index + 1) / this.data.order.length) * 100) }); },
  previous() { this.move(-1); }, next() { this.move(1); },
  async submit() { if (this.data.submitting) return; const unanswered = this.data.order.filter((wordId) => !String(this.data.answers[wordId] ?? '').trim()).length; const modal = await wx.showModal({ title: '确认正式提交', content: `提交后成绩不可修改。${unanswered ? `还有 ${unanswered} 题未答，将按错误计分。` : ''}` }); if (!modal.confirm) return; this.setData({ submitting: true }); try { await api.attempt.submitFormal(this.data.taskId, this.data.answers); wx.removeStorageSync(`dictation:${this.data.taskId}`); wx.redirectTo({ url: `/pages/result/index?taskId=${this.data.taskId}` }); } catch(error) { showError(error); } finally { this.setData({ submitting: false }); } },
});
