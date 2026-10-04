import { api } from '../../services/api';
import { showError } from '../../utils/errors';
import type { PracticeResult } from '../../types/api';
import type { TaskWordDocument } from '../../../shared/types';
Page({
  data: { state: 'loading' as LoadState, taskId: '', practiceId: '', order: [] as string[], wordsById: {} as Record<string, TaskWordDocument>, answers: {} as Record<string,string>, index: 0, result: null as PracticeResult | null, submitting: false },
  onLoad(options: Record<string,string>) { this.setData({ taskId: options.taskId ?? '' }); void this.load(); },
  async load() { try { const [formal, practice] = await Promise.all([api.attempt.getResult(this.data.taskId), api.attempt.startWrongPractice(this.data.taskId)]); const wordsById: Record<string, TaskWordDocument> = {}; formal.items.forEach((item) => { wordsById[item.wordId] = item.word; }); this.setData({ practiceId: practice.practiceId ?? '', order: practice.questionOrder, wordsById, result: null, index: 0, answers: {}, state: practice.questionOrder.length ? 'ready' : 'empty' }); } catch(error) { this.setData({ state: 'error' }); showError(error); } },
  onAnswer(event: WechatMiniprogram.Input) { const wordId = this.data.order[this.data.index]!; this.setData({ answers: { ...this.data.answers, [wordId]: event.detail.value } }); },
  move(offset: number) { this.setData({ index: Math.max(0, Math.min(this.data.order.length - 1, this.data.index + offset)) }); }, previous() { this.move(-1); }, next() { this.move(1); },
  async submit() { if (this.data.submitting) return; this.setData({ submitting: true }); try { const result = await api.attempt.submitWrongPractice(this.data.practiceId, this.data.answers); this.setData({ result }); } catch(error) { showError(error); } finally { this.setData({ submitting: false }); } },
});
