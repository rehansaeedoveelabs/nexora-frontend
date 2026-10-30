import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { dashboardService } from '../services/dashboard.js';
import { capacityService } from '../services/capacity.js';
import { number, percent } from '../lib/format.js';
import { ErrorState, LoadingState } from '../components/states.jsx';
import { KpiCard } from '../components/ui.jsx';
import { DonutChart, LineChart, SERIES } from '../components/charts.jsx';
import { Select } from '../components/fields.jsx';

const RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
];

export default function Analytics() {
  const navigate = useNavigate();
  const [state, setState] = useState({ status: 'loading' });
  const [days, setDays] = useState('30');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      dashboardService.overview(Number(days)),
      capacityService.overview(),
    ])
      .then(([analytics, capacity]) => !cancelled && setState({ status: 'ready', analytics, capacity }))
      .catch((error) => !cancelled && setState({ status: 'error', error }));
    return () => { cancelled = true; };
  }, [days, reloadKey]);

  if (state.status === 'loading') return <s-page heading="Fulfillment analytics" inlineSize="large"><LoadingState label="Loading live fulfillment analytics…" /></s-page>;
  if (state.status === 'error') return <s-page heading="Fulfillment analytics" inlineSize="large"><ErrorState error={state.error} onRetry={() => setReloadKey((key) => key + 1)} /></s-page>;

  const { analytics, capacity } = state;
  const orderTotal = analytics.totals.orders;
  const assignedRate = orderTotal ? analytics.totals.assigned / orderTotal : 0;
  const splitRate = analytics.totals.assigned ? analytics.totals.split / analytics.totals.assigned : 0;
  const capacityByLocation = new Map(capacity.rows.map((row) => [String(row.id), row]));

  return (
    <s-page heading="Fulfillment analytics" inlineSize="large">
      <s-button slot="secondary-actions" onClick={() => setReloadKey((key) => key + 1)}>Refresh</s-button>
      <s-button slot="secondary-actions" onClick={() => navigate('/orders')}>Explore orders</s-button>
      <s-stack gap="base">
        <s-banner tone="info" heading="Live Shopify order data">
          <s-paragraph>
            Order counts use the selected creation-date range and the shop timezone ({analytics.timezone}). Location breakdowns show current Shopify fulfillment assignments, not historical routing decisions. Shopify order access is limited to the most recent 60 days; shipping spend and fulfillment-time metrics are not available from the data currently collected.
          </s-paragraph>
        </s-banner>

        <s-stack direction="inline" gap="small" alignItems="center" justifyContent="end">
          <s-text color="subdued">Showing</s-text>
          <Select label="Date range" hideLabel value={days} options={RANGES} onChange={setDays} />
        </s-stack>

        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap="base">
          <KpiCard label={`Orders created · ${analytics.days} days`} value={number(orderTotal)} onClick={() => navigate('/orders')} />
          <KpiCard label="Currently assigned" value={number(analytics.totals.assigned)} help={`${percent(assignedRate)} of non-cancelled orders have an assigned fulfillment location`} />
          <KpiCard label="Fulfilled" value={number(analytics.totals.fulfilled)} help="Current Shopify fulfillment status" />
          <KpiCard label="Split across locations" value={number(analytics.totals.split)} help={`${percent(splitRate)} of currently assigned orders span multiple locations`} />
        </s-grid>

        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(320px, 1fr))" gap="base">
          <s-section heading="Daily order volume">
            <s-stack gap="base">
              <s-text color="subdued">Non-cancelled orders created each day and the subset currently assigned.</s-text>
              <LineChart
                labels={analytics.trend.map((item) => item.label)}
                series={[
                  { name: 'Orders', color: SERIES[0], values: analytics.trend.map((item) => item.orders) },
                  { name: 'Currently assigned', color: SERIES[1], values: analytics.trend.map((item) => item.assigned) },
                ]}
                format={number}
              />
            </s-stack>
          </s-section>

          <s-section heading="Assignments by location type">
            <s-stack gap="base">
              <s-text color="subdued">Each assigned location is counted; a split order can appear in more than one location.</s-text>
              <DonutChart data={analytics.byType.map((item) => ({ label: item.name, value: item.value }))} centerLabel="assignments" format={number} />
            </s-stack>
          </s-section>
        </s-grid>

        <s-section heading="Current assignment by location">
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Location</s-table-header>
              <s-table-header>Type</s-table-header>
              <s-table-header>Assigned orders</s-table-header>
              <s-table-header>Fulfilled</s-table-header>
              <s-table-header>Capacity used today</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {analytics.distribution.map((row) => {
                const today = capacityByLocation.get(row.id);
                return (
                  <s-table-row key={row.id}>
                    <s-table-cell>
                      <s-clickable onClick={() => navigate(`/locations/${row.id}`)}><s-text type="strong">{row.name}</s-text></s-clickable>
                    </s-table-cell>
                    <s-table-cell>{row.type ? row.type.replace('_', ' ') : 'Unclassified'}</s-table-cell>
                    <s-table-cell>{number(row.value)}</s-table-cell>
                    <s-table-cell>{number(row.fulfilled)}</s-table-cell>
                    <s-table-cell>{today?.utilization == null ? '—' : percent(today.utilization)}</s-table-cell>
                  </s-table-row>
                );
              })}
            </s-table-body>
          </s-table>
          {analytics.distribution.length === 0 && (
            <s-paragraph color="subdued">No synced locations are available for this period. Sync locations or review the live orders list.</s-paragraph>
          )}
        </s-section>
      </s-stack>
    </s-page>
  );
}
