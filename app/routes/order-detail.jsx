import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ordersService } from '../services/orders.js';
import { money, number, date } from '../lib/format.js';
import { toast } from '../lib/api.js';
import { ErrorState, LoadingState } from '../components/states.jsx';
import { ConfirmDialog, DetailList, StatusBadge } from '../components/ui.jsx';
import { Select } from '../components/fields.jsx';

const REASSIGN_DIALOG_ID = 'nx-order-reassignment';
export default function OrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [destinationId, setDestinationId] = useState('');
  const [reassigning, setReassigning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    ordersService.get(orderId)
      .then(({ order, locations }) => {
        if (cancelled) return;
        setState(order ? { status: 'ready', order, locations } : { status: 'missing' });
      })
      .catch((error) => {
        if (cancelled) return;
        if (error.status === 404) setState({ status: 'missing' });
        else setState({ status: 'error', error });
      });
    return () => { cancelled = true; };
  }, [orderId, reloadKey]);

  const destinationOptions = useMemo(() => state.status === 'ready'
    ? state.locations
      .filter((location) => location.is_active && location.ships && !location.managed_by_app
        && String(location.id) !== state.order.assignedLocationId)
      .map((location) => ({
        value: String(location.id),
        label: [location.name, location.city].filter(Boolean).join(' · '),
      }))
    : [], [state]);

  async function reassignOrder() {
    setReassigning(true);
    try {
      const result = await ordersService.reassign(orderId, destinationId);
      toast(result.partial
        ? `${result.order_name} was partially moved. Review the remaining fulfillment in Shopify.`
        : `${result.order_name} moved to ${result.destination_name}.`);
      setDestinationId('');
      setReloadKey((key) => key + 1);
    } catch (error) {
      toast(error.message, true);
      setReloadKey((key) => key + 1);
    } finally {
      setReassigning(false);
    }
  }

  if (state.status === 'loading') return <s-page heading="Order" inlineSize="large"><LoadingState /></s-page>;
  if (state.status === 'error') return <s-page heading="Order" inlineSize="large"><ErrorState error={state.error} onRetry={() => setReloadKey((k) => k + 1)} /></s-page>;
  if (state.status === 'missing') {
    return (
      <s-page heading="Order not found" inlineSize="large">
        <s-section><s-stack gap="base" alignItems="start"><s-paragraph>This order could not be found in Shopify.</s-paragraph><s-button variant="primary" onClick={() => navigate('/orders')}>Back to orders</s-button></s-stack></s-section>
      </s-page>
    );
  }

  const { order: o } = state;
  const selectedDestination = destinationOptions.find((option) => option.value === destinationId);

  return (
    <s-page heading={`Order ${o.number}`} inlineSize="large">
      <s-button slot="secondary-actions" onClick={() => navigate('/orders')}>Back to orders</s-button>

      <s-stack gap="base">
        <s-stack direction="inline" gap="small" alignItems="center">
          <StatusBadge kind="fulfillment" value={o.fulfillmentStatus} />
          {o.split && <s-badge tone="info" icon="transfer">Split shipment</s-badge>}
        </s-stack>

        <s-section heading="Shopify fulfillment assignment">
          {o.assignedLocationName ? (
            <s-banner tone="success" heading={`Assigned to ${o.assignedLocationName}`}>
              <s-paragraph>{o.decisionReason}</s-paragraph>
            </s-banner>
          ) : (
            <s-banner tone="warning" heading="No fulfillment location assigned">
              <s-paragraph>Shopify has not assigned a fulfillment location to this order.</s-paragraph>
            </s-banner>
          )}
        </s-section>

        <s-section heading="Reassign fulfillment">
          {!o.reassignment.permissionGranted ? (
            <s-banner tone="warning" heading="Shopify permission approval required">
              <s-paragraph>Reopen Nexora in Shopify Admin and approve the merchant-managed fulfillment write permission before moving orders.</s-paragraph>
            </s-banner>
          ) : o.reassignment.eligible ? (
            <s-stack gap="base">
              <s-paragraph>
                Choose an active merchant-managed location. Shopify checks inventory and fulfillment eligibility when the move is submitted; some items may remain at the current location.
              </s-paragraph>
              {destinationOptions.length > 0 ? (
                <>
                  <Select
                    label="New fulfillment location"
                    value={destinationId}
                    options={[{ value: '', label: 'Choose a location' }, ...destinationOptions]}
                    onChange={setDestinationId}
                  />
                  <s-button
                    variant="primary"
                    commandFor={REASSIGN_DIALOG_ID}
                    command="--show"
                    disabled={!selectedDestination || reassigning}
                  >
                    Review reassignment
                  </s-button>
                </>
              ) : (
                <s-banner tone="warning" heading="No eligible destination locations">
                  <s-paragraph>Sync an active, merchant-managed location that fulfills online orders before reassigning this order.</s-paragraph>
                </s-banner>
              )}
            </s-stack>
          ) : (
            <s-banner tone="warning" heading="This order cannot be reassigned here">
              <s-paragraph>{o.reassignment.reason}</s-paragraph>
            </s-banner>
          )}
        </s-section>

        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(300px, 1fr))" gap="base">
          <s-section heading="Order summary">
            <DetailList rows={[
              ['Order', o.number],
              ['Placed', date(o.date)],
              ['Destination', [o.destination.city, o.destination.country].filter(Boolean).join(', ') || 'Not provided'],
              ['Items', number(o.itemCount)],
            ]} />
          </s-section>

          <s-section heading="Shipping">
            <DetailList rows={[
              ['Assigned location', o.assignedLocationName ?? 'Unassigned'],
              ['Shipping charge', o.shippingEstimate != null ? money(o.shippingEstimate, { currency: o.currency, cents: true }) : 'Not available'],
              ['Fulfillment locations', number(o.shipments.length)],
            ]} />
          </s-section>
        </s-grid>

        <s-section heading="Items">
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Product</s-table-header>
              <s-table-header>SKU</s-table-header>
              <s-table-header>Tag</s-table-header>
              <s-table-header>Qty</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {o.items.map((it, i) => (
                <s-table-row key={i}>
                  <s-table-cell><s-text type="strong">{it.title}</s-text></s-table-cell>
                  <s-table-cell><s-text color="subdued">{it.sku}</s-text></s-table-cell>
                  <s-table-cell>{it.tag ? <s-badge>{it.tag}</s-badge> : '—'}</s-table-cell>
                  <s-table-cell>{it.qty}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>

        {o.shipments.length > 0 && (
          <s-section heading="Fulfillment locations">
            <s-stack gap="small-200">
              {o.shipments.map((shipment) => (
                <s-box key={shipment.locationName} border="base" borderRadius="base" padding="base">
                  <s-text type="strong">{shipment.locationName}</s-text>
                </s-box>
              ))}
            </s-stack>
          </s-section>
        )}

        <s-banner tone="info" heading="Nexora routing history is not available">
          <s-paragraph>This page shows the current Shopify assignment. Candidate comparisons and “why this location” explanations will appear after the routing-decision service is connected.</s-paragraph>
        </s-banner>

        <s-section heading="Fulfillment timeline">
          <Timeline order={o} />
        </s-section>
      </s-stack>

      <ConfirmDialog
        id={REASSIGN_DIALOG_ID}
        heading={`Move ${o.number} to ${selectedDestination?.label ?? 'another location'}?`}
        body="This changes the fulfillment assignment in Shopify. Shopify may leave items at the current location if the destination cannot fulfill them. Review the updated assignment after the move."
        confirmLabel="Move fulfillment"
        busy={reassigning}
        onConfirm={reassignOrder}
      />
    </s-page>
  );
}

function Timeline({ order }) {
  const steps = [
    ['Order placed', date(order.date), 'complete'],
    [order.assignedLocationName ? `Assigned to ${order.assignedLocationName}` : 'Awaiting fulfillment assignment', order.assignedLocationName ? 'Shopify assignment' : 'Not assigned', order.assignedLocationName ? 'complete' : 'current'],
    ['Fulfillment', order.fulfillmentStatus === 'fulfilled' ? 'Completed' : order.fulfillmentStatus === 'pending' ? 'In progress' : 'Not started', order.fulfillmentStatus === 'fulfilled' ? 'complete' : order.fulfillmentStatus === 'pending' ? 'current' : 'upcoming'],
  ];
  return (
    <s-stack gap="base">
      {steps.map(([title, detail, status], i) => (
        <s-grid key={i} gridTemplateColumns="auto 1fr" gap="base" alignItems="start">
          <s-icon type={status === 'complete' ? 'check-circle' : status === 'current' ? 'clock' : 'incomplete'} tone={status === 'complete' ? 'success' : status === 'current' ? 'info' : 'subdued'} />
          <s-stack gap="small-300">
            <s-text type="strong">{title}</s-text>
            <s-text color="subdued">{detail}</s-text>
          </s-stack>
        </s-grid>
      ))}
    </s-stack>
  );
}
