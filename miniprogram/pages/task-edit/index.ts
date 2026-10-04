import { api } from '../../services/api';
import { showError } from '../../utils/errors';
import { toPickerValues } from '../../utils/date';
import type { TaskWordInput } from '../../../shared/types';

Page({
  data: { state: 'loading' as LoadState, taskId: '', title: '', date: '', time: '', words: [] as TaskWordInput[], saving: false, publishing: false },
  onLoad(options: Record<string,string>) { const picker = toPickerValues(); this.setData({ taskId: options.taskId ?? '', date: picker.date, time: picker.time }); void this.load(); },
  async load() { try { const task = await api.task.getOwnerView(this.data.taskId); const deadline = task.deadline ? new Date(task.deadline) : null; const picker = toPickerValues(deadline ?? undefined); this.setData({ title: task.title === '未命名任务' ? '' : task.title, date: picker.date, time: picker.time, words: task.draftWords ?? [], state: 'ready' }); } catch(error) { this.setData({ state: 'error' }); showError(error); } },
  onTitle(event: WechatMiniprogram.Input) { this.setData({ title: event.detail.value }); },
  onDate(event: WechatMiniprogram.PickerChange) { this.setData({ date: String(event.detail.value) }); },
  onTime(event: WechatMiniprogram.PickerChange) { this.setData({ time: String(event.detail.value) }); },
  addWord() { this.setData({ words: [...this.data.words, { word: '', meaning: '', phonetic: '', example: '' }] }); },
  updateWord(event: WechatMiniprogram.Input) { const { index, field } = event.currentTarget.dataset as { index: number; field: keyof TaskWordInput }; const words = [...this.data.words]; words[index] = { ...words[index]!, [field]: event.detail.value }; this.setData({ words }); },
  removeWord(event: WechatMiniprogram.TouchEvent) { const index = Number(event.currentTarget.dataset.index); this.setData({ words: this.data.words.filter((_, current) => current !== index) }); },
  openImport() { wx.navigateTo({ url: `/pages/task-import/index?taskId=${this.data.taskId}`, events: { importedWords: (words: TaskWordInput[]) => this.setData({ words: [...this.data.words, ...words] }) } }); },
  async save(showToast = true) { if (this.data.saving) return false; this.setData({ saving: true }); try { const deadline = new Date(`${this.data.date}T${this.data.time}:00`).toISOString(); await api.task.updateDraft(this.data.taskId, this.data.title, deadline, this.data.words); if (showToast) wx.showToast({ title: '已保存' }); return true; } catch(error) { showError(error); return false; } finally { this.setData({ saving: false }); } },
  async publish() { if (this.data.publishing) return; const modal = await wx.showModal({ title: '发布任务', content: '发布后词表将锁定，确定发布吗？' }); if (!modal.confirm) return; this.setData({ publishing: true }); try { if (!(await this.save(false))) return; await api.task.publish(this.data.taskId); wx.showToast({ title: '发布成功' }); setTimeout(() => wx.navigateBack(), 500); } catch(error) { showError(error); } finally { this.setData({ publishing: false }); } },
});
