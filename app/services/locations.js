import { api } from '../lib/api.js';

function normalizeLocation(location) {
  return {
    id: String(location.id),
    name: location.name,
    address: location.address,
    city: location.city,
    countryCode: location.country_code,
    active: location.is_active,
    ships: location.ships,
    pickup: location.pickup,
    managedBy: location.managed_by_app,
    type: location.type,
    tags: location.tags,
    dailyCap: location.daily_order_cap,
    backlogCap: location.backlog_cap,
  };
}

export const locationsService = {
  async list() {
    const response = await api.get('/locations');
    return response.data.map(normalizeLocation);
  },

  async get(id) {
    const locations = await this.list();
    return locations.find((location) => location.id === String(id)) ?? null;
  },

  async update(id, patch) {
    const response = await api.patch(`/locations/${encodeURIComponent(id)}`, patch);
    return normalizeLocation(response.data);
  },
};
