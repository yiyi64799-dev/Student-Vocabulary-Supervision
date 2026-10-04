import type { TaskView } from '../types/api';
import { formatDateTime } from './date';

export const taskDisplay = (task: TaskView) => {
  const deadline = task.deadline ? new Date(task.deadline).getTime() : NaN;
  const hours = (deadline - Date.now()) / 3600000;
  return {
    ...task,
    deadlineLabel: formatDateTime(task.deadline),
    statusLabel: { draft: '草稿', published: '进行中', withdrawn: '已撤回' }[task.status],
    deadlineHint: task.status !== 'published' ? '' : hours < 0 ? '已过截止 · 仍可完成' : hours <= 24 ? '24 小时内截止' : '按自己的节奏完成',
    urgent: task.status === 'published' && hours <= 24,
  };
};
