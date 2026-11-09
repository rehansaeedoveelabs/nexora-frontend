import { useLocation, useNavigate } from 'react-router';

/**
 * Transitional page for routes whose full implementation lands in a later build phase. Shared by
 * several route entries so the whole navigation and every deep link work end-to-end while the app
 * is built phase by phase. Each phase swaps its route's module from this file to the real page.
 */

const TITLES = {
  '/orders': 'Routed orders',
  '/savings': 'Shipping cost savings',
  '/capacity': 'Capacity & predictions',
  '/analytics': 'Fulfillment analytics',
  '/automations': 'Automations',
  '/activity': 'Activity & decision log',
  '/settings': 'Settings',
  '/settings/fulfillment': 'Fulfillment preferences',
  '/settings/notifications': 'Notifications',
  '/settings/billing': 'Plan & usage',
  '/routing/new': 'Create routing rule',
};

export default function Placeholder() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname.replace(/\/$/, '');
  const title = TITLES[path]
    ?? (path.startsWith('/routing/') ? 'Edit routing rule'
      : path.startsWith('/orders/') ? 'Order details'
        : 'Nexora');

  return (
    <s-page heading={title} inlineSize="large">
      <s-section>
        <s-stack gap="base" alignItems="start">
          <s-badge tone="info" icon="clock">Arriving in this build</s-badge>
          <s-paragraph color="subdued">
            This section is part of the full Nexora build and is being implemented now. The foundation,
            navigation and data are already in place.
          </s-paragraph>
          <s-button variant="primary" onClick={() => navigate('/')}>Back to dashboard</s-button>
        </s-stack>
      </s-section>
    </s-page>
  );
}
