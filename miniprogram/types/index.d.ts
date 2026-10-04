interface IAppOption {
  globalData: {
    user: import('../../shared/types').UserProfile | null;
    ready: Promise<void> | null;
  };
  initializeUser(): Promise<void>;
}

type LoadState = 'loading' | 'ready' | 'empty' | 'error';
