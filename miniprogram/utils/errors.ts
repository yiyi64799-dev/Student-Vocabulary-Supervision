const messages: Record<string, string> = {
  UNAUTHORIZED: '登录状态无效，请重新进入小程序',
  FORBIDDEN: '你没有权限执行此操作',
  GROUP_NOT_FOUND: '小组不存在',
  INVALID_INVITE_CODE: '邀请码无效或已失效',
  ALREADY_IN_GROUP: '你已在该小组中',
  TASK_NOT_FOUND: '任务不存在',
  TASK_NOT_PUBLISHED: '任务尚未发布',
  TASK_WITHDRAWN: '任务已撤回',
  MEMORY_NOT_COMPLETED: '请先完成全部单词记忆',
  FORMAL_ALREADY_SUBMITTED: '正式成绩已提交，不能再次提交',
  SUBMISSION_NOT_FOUND: '尚无正式提交结果',
  TOO_MANY_WORDS: '单词数量超过上限',
  VALIDATION_ERROR: '输入内容不符合要求',
  NETWORK_ERROR: '网络异常，请稍后重试',
};

export const getErrorMessage = (code: string, fallback = '操作失败，请重试'): string => messages[code] ?? fallback;

export const showError = (error: unknown): void => {
  const message = error instanceof Error ? error.message : '操作失败，请重试';
  wx.showToast({ title: message, icon: 'none', duration: 2500 });
};

