import { api } from '../lib/api.js';

export const salesTargetService = {
  async get() {
    const response = await api.get('/sales-target');
    return response.data;
  },

  // Pass a positive integer to set, or null to clear the target.
  async update(monthlyOrderTarget) {
    const response = await api.put('/sales-target', { monthly_order_target: monthlyOrderTarget });
    return response.data;
  },
};
