import { api } from '../../services/api';
import { showError } from '../../utils/errors';
import type { RankingResult } from '../../types/api';
Page({ data: { state: 'loading' as LoadState, taskId: '', ranking: [] as RankingResult['ranking'], unfinished: [] as RankingResult['unfinished'] }, onLoad(options: Record<string,string>) { this.setData({ taskId: options.taskId ?? '' }); void this.load(); }, async load() { try { const result = await api.task.getRanking(this.data.taskId); this.setData({ ...result, state: 'ready' }); } catch(error) { this.setData({ state: 'error' }); showError(error); } } });
