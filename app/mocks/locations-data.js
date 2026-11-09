/**
 * Location master data, split out so both the seed generator and the routing simulator can import it
 * without a circular dependency (seed → simulator → locations-data; seed → locations-data).
 *
 * `dailyCap` is a fixed limit; a location's live load (ordersToday) and utilization are DERIVED from
 * the orders actually assigned to it (see services/capacity.js), so capacity figures can never
 * contradict the order list.
 */

export const LOCATIONS = [
  {
    id: 'karachi-wh', name: 'Karachi Warehouse', type: 'warehouse',
    city: 'Karachi', region: 'Sindh', country: 'PK', active: true,
    dailyCap: 10, backlog: 3, backlogCap: 15, safetyStock: 10,
    ships: true, pickup: false, managedBy: null,
    tags: ['bulk', 'apparel'], inventory: 'healthy',
    avgShipCost: 7.4, avgFulfilMins: 540,
  },
  {
    id: 'lahore-store', name: 'Lahore Flagship Store', type: 'store',
    city: 'Lahore', region: 'Punjab', country: 'PK', active: true,
    dailyCap: 12, backlog: 4, backlogCap: 14, safetyStock: 15,
    ships: true, pickup: true, managedBy: null,
    tags: ['flagship', 'apparel'], inventory: 'low',
    avgShipCost: 6.1, avgFulfilMins: 360,
  },
  {
    id: 'london-wh', name: 'London Warehouse', type: 'warehouse',
    city: 'London', region: 'England', country: 'GB', active: true,
    dailyCap: 6, backlog: 5, backlogCap: 8, safetyStock: 20,
    ships: true, pickup: false, managedBy: null,
    tags: ['eu', 'electronics'], inventory: 'critical',
    avgShipCost: 9.2, avgFulfilMins: 720,
  },
  {
    id: 'ny-store', name: 'New York Store', type: 'store',
    city: 'New York', region: 'NY', country: 'US', active: true,
    dailyCap: 8, backlog: 1, backlogCap: 12, safetyStock: 12,
    ships: true, pickup: true, managedBy: null,
    tags: ['us', 'apparel'], inventory: 'healthy',
    avgShipCost: 8.0, avgFulfilMins: 300,
  },
  {
    id: 'eu-3pl', name: 'Rotterdam 3PL', type: 'third_party',
    city: 'Rotterdam', region: 'South Holland', country: 'NL', active: true,
    dailyCap: 10, backlog: 2, backlogCap: 20, safetyStock: 0,
    ships: true, pickup: false, managedBy: 'ShipBob',
    tags: ['eu', '3pl'], inventory: 'healthy',
    avgShipCost: 10.5, avgFulfilMins: 900,
  },
];

export const LOCATION_TYPE_LABEL = {
  store: 'Retail store',
  warehouse: 'Warehouse',
  third_party: '3PL',
};
