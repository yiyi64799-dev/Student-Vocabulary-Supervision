import { api } from '../../services/api';
import { showError } from '../../utils/errors';
import type { ImportPreview } from '../../../shared/types';

Page({
  data: { taskId: '', text: '', parsing: false, preview: null as ImportPreview | null },
  onLoad(options: Record<string, string>) { this.setData({ taskId: options.taskId ?? '' }); },
  onText(event: WechatMiniprogram.Input) { this.setData({ text: event.detail.value, preview: null }); },
  async parse() { if (this.data.parsing) return; this.setData({ parsing: true }); try { const preview = await api.task.importPreview(this.data.taskId, this.data.text); this.setData({ preview }); } catch(error) { showError(error); } finally { this.setData({ parsing: false }); } },
  removeRow(event: WechatMiniprogram.TouchEvent) { if (!this.data.preview) return; const index = Number(event.currentTarget.dataset.index); this.setData({ 'preview.validRows': this.data.preview.validRows.filter((_, current) => current !== index), 'preview.validCount': this.data.preview.validCount - 1 }); },
  confirm() { if (!this.data.preview || this.data.preview.errorCount > 0 || !this.data.preview.validRows.length) { wx.showToast({ title: '请先修正错误行', icon: 'none' }); return; } const channel = this.getOpenerEventChannel(); channel?.emit?.('importedWords', this.data.preview.validRows); wx.navigateBack(); },
});
