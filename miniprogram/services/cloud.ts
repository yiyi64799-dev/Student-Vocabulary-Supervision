import type { ApiResponse } from '../../shared/types';
import { getErrorMessage } from '../utils/errors';

export class CloudApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = 'CloudApiError';
  }
}

export const callCloud = async <T>(name: string, action: string, payload: Record<string, unknown> = {}): Promise<T> => {
  try {
    const result = await wx.cloud.callFunction({ name, data: { action, payload } });
    const response = result.result as ApiResponse<T> | undefined;
    if (!response) throw new CloudApiError('EMPTY_RESPONSE', '服务没有返回结果');
    if (!response.success) throw new CloudApiError(response.error.code, getErrorMessage(response.error.code, response.error.message), response.error.details);
    return response.data;
  } catch (error) {
    if (error instanceof CloudApiError) throw error;
    const message = error instanceof Error ? error.message : '网络异常，请稍后重试';
    throw new CloudApiError('NETWORK_ERROR', message);
  }
};

