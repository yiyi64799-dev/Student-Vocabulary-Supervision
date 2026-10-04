import { CLOUD_ENV_ID } from './env';
import { api } from './services/api';

interface AppGlobalData {
  user: import('../shared/types').UserProfile | null;
  ready: Promise<void> | null;
}

App<IAppOption>({
  globalData: { user: null, ready: null } as AppGlobalData,
  onLaunch() {
    if (!wx.cloud) {
      wx.showModal({ title: '基础库版本过低', content: '请升级微信后重试', showCancel: false });
      return;
    }
    wx.cloud.init({ env: CLOUD_ENV_ID || undefined, traceUser: true });
    this.globalData.ready = this.initializeUser();
  },
  async initializeUser() {
    try {
      this.globalData.user = await api.auth.ensureUser();
    } catch (error) {
      console.error('用户初始化失败', error);
    }
  },
});
