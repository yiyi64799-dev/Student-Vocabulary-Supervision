import { BusinessError, fail, ok } from './runtime';
import { ERROR_CODES } from '../../shared/constants';
import type { ApiResponse, CloudActionEvent } from '../../shared/types';

type Handler = (payload: Record<string, unknown>) => Promise<unknown>;

export const route = async (
  event: CloudActionEvent,
  handlers: Record<string, Handler>,
): Promise<ApiResponse<unknown>> => {
  try {
    if (!event || typeof event.action !== 'string' || !handlers[event.action]) {
      throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, '未知操作');
    }
    const handler = handlers[event.action];
    if (!handler) throw new BusinessError(ERROR_CODES.VALIDATION_ERROR, '未知操作');
    const data = await handler((event.payload ?? {}) as Record<string, unknown>);
    return ok(data);
  } catch (error) {
    return fail(error);
  }
};
