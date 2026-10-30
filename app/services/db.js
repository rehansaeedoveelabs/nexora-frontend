import * as seed from '../mocks/seed.js';

/**
 * In-memory demo database. The seed is deep-cloned once at load so demo edits persist while the app
 * is open, without mutating the immutable seed. Reloading the app resets to the seed.
 *
 * Every mock service reads and writes through this module. Swapping to a real backend later means
 * replacing the service modules (app/services/*), not the pages.
 */
const clone = (value) => (typeof structuredClone === 'function'
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value)));

export const db = {
  locations: clone(seed.LOCATIONS),
  orders: clone(seed.ORDERS),
  rules: clone(seed.ROUTING_RULES),
};

/** Simulate network latency so loading states are real and the UI stays honest. */
export function delay(ms = 180) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Return a detached copy so callers can never mutate the store by reference. */
export const copy = clone;

export const genId = (prefix) => `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

/** Current load (orders assigned) for a location — the basis for capacity figures. */
export const locationLoad = (locationId) => db.orders.filter((o) => o.assignedLocationId === locationId).length;
