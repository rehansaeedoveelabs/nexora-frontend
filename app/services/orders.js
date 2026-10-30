import { api } from '../lib/api.js';

export const ordersService = {
  async list(after = null) {
    const [ordersResponse, locationsResponse] = await Promise.all([
      api.get(`/orders?first=20${after ? `&after=${encodeURIComponent(after)}` : ''}`),
      api.get('/locations'),
    ]);

    return {
      orders: ordersResponse.data,
      pageInfo: ordersResponse.meta.page_info,
      locations: locationsResponse.data,
    };
  },

  async get(id) {
    const [orderResponse, locationsResponse] = await Promise.all([
      api.get(`/orders/${encodeURIComponent(id)}`),
      api.get('/locations'),
    ]);
    return {
      order: orderResponse.data,
      locations: locationsResponse.data,
    };
  },

  async reassign(id, destinationLocationId) {
    const response = await api.post(`/orders/${encodeURIComponent(id)}/reassign`, {
      destination_location_id: Number(destinationLocationId),
    });
    return response.data;
  },
};
