import { api } from '../lib/api.js';

export const savingsService = {
  async overview() {
    const response = await api.get('/savings');
    return response.data;
  },
};
