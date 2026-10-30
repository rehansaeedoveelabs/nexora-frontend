import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { dashboardService } from '../services/dashboard.js';
import { capacityService } from '../services/capacity.js';
import { LOCATION_TYPE_LABEL } from '../mocks/seed.js';
import { date, number, percent, plural } from '../lib/format.js';
import { ErrorState, LoadingState } from '../components/states.jsx';
import { KpiCard, StatusBadge } from '../components/ui.jsx';
import { LineChart, BarChart, Meter, SERIES } from '../components/charts.jsx';
import { Select } from '../components/fields.jsx';
import SetupPanel from '../components/SetupPanel.jsx';

const RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
];

export default function Home() {
  const navigate = useNavigate();
  const [state, setState] = useState({ status: 'loading' });
  const [days, setDays] = useState('30');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([dashboardService.overview(Number(days)), capacityService.overview()])
      .then(([dashboard, capacity]) => !cancelled && setState({ status: 'ready', dashboard, capacity }))
      .catch((error) => !cancelled && setState({ status: 'error', error }));
    return () => { cancelled = true; };
  }, [days, reloadKey]);

  if (state.status === 'loading') return <s-page heading="Fulfillment overview" inlineSize="large"><LoadingState label="Loading your overview…" /></s-page>;
  if (state.status === 'error') return <s-page heading="Fulfillment overview" inlineSize="large"><ErrorState error={state.error} /></s-page>;

  const { dashboard, capacity } = state;
  const atRisk = capacity.rows.filter((row) => ['watch', 'overload'].includes(row.forecast));
  const unconfigured = capacity.rows.filter((row) => row.forecast === 'unconfigured');

  return (
    <s-page heading="Fulfillment overview" inlineSize="large">
      <s-button slot="secondary-actions" onClick={() => setReloadKey((key) => key + 1)}>Refresh</s-button>
      <s-button slot="secondary-actions" onClick={() => navigate('/orders')}>View orders</s-button>

      <s-stack gap="base">
        <s-banner tone="info" heading="Live Shopify data">
          <s-paragraph>
            Order counts and current fulfillment assignments come from Shopify for the selected period. Shopify order access is limited to the most recent 60 days. Routing history, carrier costs and fulfillment event history are not yet tracked.
          </s-paragraph>
        </s-banner>

        <SetupPanel />

        <s-stack direction="inline" gap="small" alignItems="center" justifyContent="end">
          <s-text color="subdued">Showing</s-text>
          <Select label="Date range" hideLabel value={days} options={RANGES} onChange={setDays} />
        </s-stack>

        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
          <KpiCard label={`Orders created · ${dashboard.days} days`} value={number(dashboard.totals.orders)} onClick={() => navigate('/orders')} />
          <KpiCard label="Currently assigned" value={number(dashboard.totals.assigned)} help="Orders with a current Shopify fulfillment location" onClick={() => navigate('/orders')} />
          <KpiCard label="Currently unassigned" value={number(dashboard.totals.unassigned)} help="No current fulfillment location assignment" onClick={() => navigate('/orders')} />
          <KpiCard label="Fulfilled" value={number(dashboard.totals.fulfilled)} help="Shopify fulfillment status" onClick={() => navigate('/orders')} />
        </s-grid>

        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(320px, 1fr))" gap="base">
          <s-section heading="Orders over time">
            <s-stack gap="base">
              <s-text color="subdued">Live, non-cancelled Shopify orders created each day and the subset currently assigned.</s-text>
              <LineChart
                labels={dashboard.trend.map((item) => item.label)}
                series={[
                  { name: 'Orders created', color: SERIES[0], values: dashboard.trend.map((item) => item.orders) },
                  { name: 'Currently assigned', color: SERIES[1], values: dashboard.trend.map((item) => item.assigned) },
                ]}
                format={number}
              />
            </s-stack>
          </s-section>

          <s-section heading="Current assignment by location">
            <s-stack gap="base">
              <s-text color="subdued">Selected-period orders grouped by their current Shopify fulfillment location.</s-text>
              <BarChart data={dashboard.distribution.map((item) => ({ label: item.name, value: item.value }))} format={number} />
            </s-stack>
          </s-section>
        </s-grid>

        <s-section heading="Location capacity today">
          <CapacityTable rows={capacity.rows} onOpen={(id) => navigate(`/locations/${id}`)} />
        </s-section>

        <s-section heading="Recent orders">
          <RecentOrders orders={dashboard.recentOrders} onOpen={(id) => navigate(`/orders/${id}`)} />
        </s-section>

        <s-section heading="Needs attention">
          <NeedsAttention atRisk={atRisk} unconfigured={unconfigured} navigate={navigate} />
        </s-section>
      </s-stack>
    </s-page>
  );
}

function CapacityTable({ rows, onOpen }) {
  return (
    <s-table>
      <s-table-header-row>
        <s-table-header listSlot="primary">Location</s-table-header>
        <s-table-header>Type</s-table-header>
        <s-table-header>Daily capacity</s-table-header>
        <s-table-header>Assigned</s-table-header>
        <s-table-header>Utilization</s-table-header>
      </s-table-header-row>
      <s-table-body>
        {rows.map((r) => (
          <s-table-row key={r.id}>
            <s-table-cell>
              <s-clickable onClick={() => onOpen(r.id)}><s-text type="strong">{r.name}</s-text></s-clickable>
            </s-table-cell>
            <s-table-cell><s-text color="subdued">{LOCATION_TYPE_LABEL[r.type] ?? 'Unclassified'}</s-text></s-table-cell>
            <s-table-cell>{r.dailyCap == null ? 'Not set' : number(r.dailyCap)}</s-table-cell>
            <s-table-cell>{number(r.ordersToday)}</s-table-cell>
            <s-table-cell>
              <s-stack gap="small-300">
                <s-stack direction="inline" gap="small" alignItems="center" justifyContent="space-between">
                  <s-text style={{ fontVariantNumeric: 'tabular-nums' }}>{r.utilization == null ? '—' : percent(r.utilization)}</s-text>
                  <StatusBadge kind="forecast" value={r.forecast} />
                </s-stack>
                {r.utilization != null && <Meter value={r.utilization} label={`${r.name} utilization`} />}
              </s-stack>
            </s-table-cell>
          </s-table-row>
        ))}
      </s-table-body>
    </s-table>
  );
}

function RecentOrders({ orders, onOpen }) {
  return (
    <s-table>
      <s-table-header-row>
        <s-table-header listSlot="primary">Order</s-table-header>
        <s-table-header>Date</s-table-header>
        <s-table-header>Destination</s-table-header>
        <s-table-header>Location</s-table-header>
        <s-table-header listSlot="inline">Fulfillment</s-table-header>
      </s-table-header-row>
      <s-table-body>
        {orders.map((o) => (
          <s-table-row key={o.id}>
            <s-table-cell>
              <s-clickable onClick={() => onOpen(o.id)}><s-text type="strong">{o.number}</s-text></s-clickable>
            </s-table-cell>
            <s-table-cell>{date(o.date)}</s-table-cell>
            <s-table-cell>{[o.destination.city, o.destination.country].filter(Boolean).join(', ') || '—'}</s-table-cell>
            <s-table-cell>{o.assignedLocationName ?? <s-text color="subdued">Unassigned</s-text>}</s-table-cell>
            <s-table-cell><StatusBadge kind="fulfillment" value={o.fulfillmentStatus} /></s-table-cell>
          </s-table-row>
        ))}
      </s-table-body>
    </s-table>
  );
}

function NeedsAttention({ atRisk, unconfigured, navigate }) {
  const items = [];
  atRisk.forEach((r) => {
    items.push([
      r.forecast === 'overload' ? 'critical' : 'warning',
      `${r.name} is ${r.forecast === 'overload' ? 'at overload risk' : 'nearing capacity'}`,
      `${percent(r.utilization)} of its configured daily order limit is currently used.`,
      'View location',
      `/locations/${r.id}`,
    ]);
  });
  if (unconfigured.length) {
    items.push([
      'warning',
      `${plural(unconfigured.length, 'location has', 'locations have')} no daily order limit configured.`,
      'Set a daily limit to include these locations in capacity utilization.',
      'Manage locations',
      '/locations',
    ]);
  }

  if (items.length === 0) {
    return (
      <s-banner tone="success" heading="Nothing needs attention">
        <s-paragraph>No configured location is at its capacity watch threshold.</s-paragraph>
      </s-banner>
    );
  }

  return (
    <s-stack gap="base">
      {items.map(([tone, heading, body, cta, url], i) => (
        <s-banner key={i} tone={tone} heading={heading}>
          <s-paragraph>{body}</s-paragraph>
          <s-button slot="secondary-actions" onClick={() => navigate(url)}>{cta}</s-button>
        </s-banner>
      ))}
    </s-stack>
  );
}
