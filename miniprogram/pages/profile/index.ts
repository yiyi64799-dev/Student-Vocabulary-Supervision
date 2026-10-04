import { api } from '../../services/api';
import { showError } from '../../utils/errors';
Page({
  data: { nickname: '', avatarUrl: '', saving: false, isTeacher: false, code: '', activating: false },
  onLoad() { const user = getApp<IAppOption>().globalData.user; this.setData({ nickname: user?.nickname ?? '', avatarUrl: user?.avatarUrl ?? '', isTeacher: user?.accountRole === 'teacher' }); },
  onCode(event: WechatMiniprogram.Input) { this.setData({ code: event.detail.value }); },
  async activate() {
    if (this.data.activating) return;
    this.setData({ activating: true });
    try {
      const user = await api.auth.activateTeacher(this.data.code);
      getApp<IAppOption>().globalData.user = user;
      this.setData({ isTeacher: true, code: '' });
      wx.showToast({ title: '教师身份已开通' });
      wx.reLaunch({ url: '/pages/teacher/index' });
    } catch (error) { showError(error); } finally { this.setData({ activating: false }); }
  },
  openTeacher() { wx.reLaunch({ url: '/pages/teacher/index' }); },
  onNickname(event: WechatMiniprogram.Input) { this.setData({ nickname: event.detail.value }); },
  onChooseAvatar(event: WechatMiniprogram.CustomEvent<{ avatarUrl: string }>) { this.setData({ avatarUrl: event.detail.avatarUrl }); },
  async save() { if (this.data.saving) return; this.setData({ saving: true }); try { const user = await api.auth.updateProfile(this.data.nickname, this.data.avatarUrl) as IAppOption['globalData']['user']; getApp<IAppOption>().globalData.user = user; wx.showToast({ title: '已保存' }); } catch(error) { showError(error); } finally { this.setData({ saving: false }); } },
});
