import { api } from '../lib/api.js';

export const activityService = {
  async list(after = null, type = 'all') {
    const params = new URLSearchParams({ first: '50' });
    if (after) params.set('after', after);
    if (type !== 'all') params.set('type', type);
    const response = await api.get(`/activity?${params}`);
    return {
      events: response.data,
      pageInfo: response.meta.page_info,
    };
  },
};
