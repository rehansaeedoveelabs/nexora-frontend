import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { savingsService } from '../services/savings.js';
import { dateTime, number } from '../lib/format.js';
import { ErrorState, LoadingState } from '../components/states.jsx';
import { KpiCard } from '../components/ui.jsx';

function statusTone(status) {
  return status === 'ready' ? 'success' : 'caution';
}

function statusLabel(status) {
  return status === 'ready' ? 'Ready' : 'Not connected';
}

export default function Savings() {
  const navigate = useNavigate();
  const [state, setState] = useState({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    savingsService.overview()
      .then((savings) => !cancelled && setState({ status: 'ready', savings }))
      .catch((error) => !cancelled && setState({ status: 'error', error }));
    return () => { cancelled = true; };
  }, [reloadKey]);

  if (state.status === 'loading') {
    return <s-page heading="Shipping savings" inlineSize="large"><LoadingState label="Loading live savings readiness…" /></s-page>;
  }
  if (state.status === 'error') {
    return (
      <s-page heading="Shipping savings" inlineSize="large">
        <ErrorState error={state.error} onRetry={() => setReloadKey((key) => key + 1)} />
      </s-page>
    );
  }

  const { savings } = state;
  const shipping = savings.operations.shipping_locations;
  const decisions = savings.operations.routing_decisions;

  return (
    <s-page heading="Shipping savings" inlineSize="large">
      <s-button slot="secondary-actions" onClick={() => setReloadKey((key) => key + 1)}>Refresh</s-button>
      <s-button slot="secondary-actions" onClick={() => navigate('/analytics')}>View live analytics</s-button>
      <s-stack gap="base">
        <s-banner tone="info" heading="Savings are not yet measurable">
          <s-paragraph>{savings.reporting.reason}</s-paragraph>
        </s-banner>

        <s-section heading="What is needed for a reliable savings report">
          <s-stack gap="base">
            {savings.requirements.map((requirement) => (
              <s-stack key={requirement.id} gap="small-100">
                <s-stack direction="inline" gap="small-200" alignItems="center">
                  <s-badge tone={statusTone(requirement.status)}>{statusLabel(requirement.status)}</s-badge>
                  <s-text type="strong">{requirement.label}</s-text>
                </s-stack>
                <s-paragraph color="subdued">{requirement.detail}</s-paragraph>
              </s-stack>
            ))}
            <s-paragraph color="subdued">
              Until those inputs are connected, Nexora intentionally does not display demo estimates as merchant savings.
            </s-paragraph>
          </s-stack>
        </s-section>

        <s-section heading="Live operational data">
          <s-stack gap="base">
            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap="base">
              <KpiCard
                label="Active shipping locations"
                value={number(shipping.shipping)}
                help={`${number(shipping.typed_shipping)} typed · ${number(shipping.active)} active total`}
                onClick={() => navigate('/locations')}
              />
              <KpiCard
                label="Routing decisions recorded"
                value={number(decisions.total)}
                help={`${number(decisions.automatic)} automatic · ${number(decisions.manual)} manual`}
                onClick={() => navigate('/activity')}
              />
              <KpiCard
                label="Last routing decision"
                value={decisions.last_at ? dateTime(decisions.last_at) : 'None yet'}
                help="From Activity automatic and manual moves"
                onClick={() => navigate('/activity')}
              />
            </s-grid>
            <s-paragraph color="subdued">{savings.operations.customer_shipping.note}</s-paragraph>
            <s-stack direction="inline" gap="base">
              <s-button variant="primary" onClick={() => navigate('/orders')}>Review Shopify orders</s-button>
              <s-button onClick={() => navigate('/routing')}>Review routing configuration</s-button>
              <s-button onClick={() => navigate('/activity')}>Open activity</s-button>
              <s-button onClick={() => navigate('/locations')}>Review locations</s-button>
            </s-stack>
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}
