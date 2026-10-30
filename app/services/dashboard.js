import { api } from '../lib/api.js';

export const dashboardService = {
  async overview(days = 30) {
    const response = await api.get(`/dashboard?days=${encodeURIComponent(days)}`);
    return response.data;
  },
};
