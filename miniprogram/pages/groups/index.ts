import { api } from '../../services/api';
import { showError } from '../../utils/errors';
import type { GroupSummary } from '../../types/api';

Page({
  data: { state: 'loading' as LoadState, groups: [] as GroupSummary[], code: '', joining: false, showJoin: false },
  onLoad() { void this.load(); },
  onPullDownRefresh() { void this.load().finally(() => wx.stopPullDownRefresh()); },
  async load() { this.setData({ state: 'loading' }); try { const groups = await api.group.listMine(); this.setData({ groups, state: groups.length ? 'ready' : 'empty' }); } catch (error) { this.setData({ state: 'error' }); showError(error); } },
  toggleJoin() { this.setData({ showJoin: !this.data.showJoin }); },
  onCode(event: WechatMiniprogram.Input) { this.setData({ code: event.detail.value.trim().toUpperCase() }); },
  async join() {
    if (this.data.joining) return;
    this.setData({ joining: true });
    try {
      const result = await api.group.joinByCode(this.data.code);
      this.setData({ code: '', showJoin: false });
      await this.load();
      wx.navigateTo({ url: `/pages/group-detail/index?groupId=${result.groupId}` });
    } catch (error) { showError(error); } finally { this.setData({ joining: false }); }
  },
  open(event: WechatMiniprogram.TouchEvent) { wx.navigateTo({ url: `/pages/group-detail/index?groupId=${event.currentTarget.dataset.id}` }); },
});
