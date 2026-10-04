import { groupHandlers } from '../../_shared/domain';
import { route } from '../../_shared/router';
import type { CloudActionEvent } from '../../../shared/types';

export const main = (event: CloudActionEvent) => route(event, groupHandlers);

