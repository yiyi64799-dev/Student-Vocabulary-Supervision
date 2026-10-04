import { api } from '../../services/api';
import { showError } from '../../utils/errors';
import { formatDateTime } from '../../utils/date';
import type { GroupMemberView } from '../../types/api';
Page({ data: { state: 'loading' as LoadState, groupId: '', members: [] as GroupMemberView[], formatDateTime }, onLoad(options: Record<string,string>) { this.setData({ groupId: options.groupId ?? '' }); void this.load(); }, async load() { try { const source = await api.group.listMembers(this.data.groupId); const members = source.map((member) => ({ ...member, initial: String(member.nickname ?? '微').slice(0, 1) })); this.setData({ members, state: members.length ? 'ready' : 'empty' }); } catch(error) { this.setData({ state: 'error' }); showError(error); } } });
