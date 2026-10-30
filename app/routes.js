import { index, route } from '@react-router/dev/routes';

export default [
  index('routes/home.jsx'),                              // Dashboard
  route('setup', 'routes/setup-redirect.jsx'),

  route('locations', 'routes/locations.jsx'),
  route('locations/:locationId', 'routes/location-detail.jsx'),

  route('routing', 'routes/routing.jsx'),
  route('routing/new', 'routes/rule-editor.jsx', { id: 'routing-new' }),
  route('routing/:ruleId', 'routes/rule-editor.jsx', { id: 'routing-edit' }),

  route('orders', 'routes/orders.jsx'),
  route('orders/:orderId', 'routes/order-detail.jsx'),

  route('savings', 'routes/savings.jsx'),
  route('capacity', 'routes/capacity.jsx'),

  route('analytics', 'routes/analytics.jsx'),
  route('automations', 'routes/automations.jsx'),
  route('activity', 'routes/activity.jsx'),

  route('settings', 'routes/settings.jsx'),
  route('settings/fulfillment', 'routes/settings.jsx', { id: 'settings-fulfillment' }),
  route('settings/notifications', 'routes/settings.jsx', { id: 'settings-notifications' }),
  route('settings/billing', 'routes/settings.jsx', { id: 'settings-billing' }),

  route('*', 'routes/not-found.jsx'),
];
