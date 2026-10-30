import { useLocation, useNavigate } from 'react-router';

const PAGES = [
  { path: '/settings', key: 'general', title: 'General', heading: 'General settings' },
  { path: '/settings/fulfillment', key: 'fulfillment', title: 'Fulfillment', heading: 'Fulfillment preferences' },
  { path: '/settings/notifications', key: 'notifications', title: 'Notifications', heading: 'Notifications' },
  { path: '/settings/billing', key: 'billing', title: 'Plan & usage', heading: 'Plan & usage' },
];

export default function Settings() {
  const location = useLocation();
  const navigate = useNavigate();
  const page = PAGES.find((item) => item.path === location.pathname) ?? PAGES[0];

  return (
    <s-page heading={page.heading} inlineSize="large">
      <s-stack gap="base">
        <s-stack direction="inline" gap="small" alignItems="center">
          {PAGES.map((item) => (
            <s-button key={item.key} variant={page.key === item.key ? 'primary' : 'tertiary'} onClick={() => navigate(item.path)}>{item.title}</s-button>
          ))}
        </s-stack>

        {page.key === 'general' && (
          <>
            <s-banner tone="info" heading="General preferences are not persisted yet">
              <s-paragraph>
                Nexora does not currently save display density, reporting currency, or separate general defaults. Live routing rules and location configuration are available in their operational screens.
              </s-paragraph>
            </s-banner>
            <s-section heading="Manage live configuration">
              <s-stack direction="inline" gap="base">
                <s-button variant="primary" onClick={() => navigate('/routing')}>Routing configuration</s-button>
                <s-button onClick={() => navigate('/locations')}>Locations</s-button>
              </s-stack>
            </s-section>
          </>
        )}

        {page.key === 'fulfillment' && (
          <>
            <s-banner tone="info" heading="Use live routing and location controls">
              <s-paragraph>
                Eligible locations, routing priorities, product constraints and split behavior are managed by the live Routing screen. Daily location limits and fulfillment tags are managed in Locations.
              </s-paragraph>
            </s-banner>
            <s-section heading="Manage fulfillment behavior">
              <s-stack direction="inline" gap="base">
                <s-button variant="primary" onClick={() => navigate('/routing')}>Routing rules and priorities</s-button>
                <s-button onClick={() => navigate('/locations')}>Location limits and tags</s-button>
                <s-button onClick={() => navigate('/capacity')}>Live capacity</s-button>
              </s-stack>
            </s-section>
          </>
        )}

        {page.key === 'notifications' && (
          <>
            <s-banner tone="warning" heading="Notification delivery is not configured">
              <s-paragraph>
                Nexora has no email or messaging delivery integration connected. No switches are shown because changing a preference would not send a notification.
              </s-paragraph>
            </s-banner>
            <s-section heading="Required before notifications can be enabled">
              <s-stack gap="base">
                <s-paragraph>Choose notification recipients and supported event types.</s-paragraph>
                <s-paragraph>Configure and verify a delivery provider, including retries and delivery-failure reporting.</s-paragraph>
                <s-button onClick={() => navigate('/activity')}>Review recorded Nexora changes</s-button>
              </s-stack>
            </s-section>
          </>
        )}

        {page.key === 'billing' && (
          <>
            <s-banner tone="warning" heading="Shopify Billing is not connected">
              <s-paragraph>
                No plan price, usage allowance, or subscription status is available from the current integration. This screen does not initiate charges or display demo plan values.
              </s-paragraph>
            </s-banner>
            <s-section heading="Billing integration required">
              <s-paragraph>Connect Shopify Billing and verify subscription lifecycle webhooks before showing plan or usage details.</s-paragraph>
            </s-section>
          </>
        )}
      </s-stack>
    </s-page>
  );
}
