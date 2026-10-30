import { api } from '../lib/api.js';

export const capacityService = {
  async overview() {
    const response = await api.get('/capacity');
    return response.data;
  },
};
