import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { dashboardService } from '../services/dashboard.js';
import { capacityService } from '../services/capacity.js';
import { activityService } from '../services/activity.js';
import { salesTargetService } from '../services/sales-target.js';
import { number, percent, dateTime } from '../lib/format.js';
import { toast } from '../lib/api.js';
import { ErrorState, LoadingState } from '../components/states.jsx';
import { KpiCard } from '../components/ui.jsx';
import { DonutChart, LineChart, SERIES } from '../components/charts.jsx';
import { NumberField, Select } from '../components/fields.jsx';

const RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
];

// Quote a CSV cell only when it contains a delimiter, quote or newline (RFC 4180).
function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows) {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export default function Analytics() {
  const navigate = useNavigate();
  const [state, setState] = useState({ status: 'loading' });
  const [days, setDays] = useState('30');
  const [reloadKey, setReloadKey] = useState(0);
  const [targetDraft, setTargetDraft] = useState('');
  const [targetBusy, setTargetBusy] = useState(false);
  const [targetError, setTargetError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      dashboardService.overview(Number(days)),
      capacityService.overview(),
      // Activity and the sales target are supplementary: a failure in either must
      // not blank the metrics view.
      activityService.list().then((result) => result.events).catch(() => []),
      salesTargetService.get().catch(() => ({ monthly_order_target: null, progress: null })),
    ])
      .then(([analytics, capacity, activity, salesTarget]) => !cancelled && setState({ status: 'ready', analytics, capacity, activity, salesTarget }))
      .catch((error) => !cancelled && setState({ status: 'error', error }));
    return () => { cancelled = true; };
  }, [days, reloadKey]);

  // Seed the editor from the loaded target (and whenever it changes).
  const loadedTarget = state.salesTarget?.monthly_order_target ?? null;
  useEffect(() => {
    setTargetDraft(loadedTarget != null ? String(loadedTarget) : '');
    setTargetError(null);
  }, [loadedTarget]);

  if (state.status === 'loading') return <s-page heading="Fulfillment analytics" inlineSize="large"><LoadingState label="Loading live fulfillment analytics…" /></s-page>;
  if (state.status === 'error') return <s-page heading="Fulfillment analytics" inlineSize="large"><ErrorState error={state.error} onRetry={() => setReloadKey((key) => key + 1)} /></s-page>;

  const { analytics, capacity, activity, salesTarget } = state;
  const orderTotal = analytics.totals.orders;

  async function saveTarget(clear = false) {
    setTargetError(null);
    let value = null;
    if (!clear) {
      value = Number(targetDraft);
      if (!Number.isInteger(value) || value < 1) {
        setTargetError('Enter a whole number of 1 or more.');
        return;
      }
    }
    setTargetBusy(true);
    try {
      const updated = await salesTargetService.update(value);
      setState((current) => ({ ...current, salesTarget: updated }));
      toast(clear ? 'Monthly target cleared' : 'Monthly target saved');
    } catch {
      setTargetError('Could not save the target. Please try again.');
    } finally {
      setTargetBusy(false);
    }
  }

  function exportCsv() {
    const rows = [
      ['Daily order volume'],
      ['Date', 'Orders', 'Assigned'],
      ...analytics.trend.map((item) => [item.label, item.orders, item.assigned]),
      [],
      ['Assignment by location'],
      ['Location', 'Type', 'Assigned orders', 'Fulfilled'],
      ...analytics.distribution.map((row) => [row.name, row.type ?? 'Unclassified', row.value, row.fulfilled]),
    ];
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nexora-insights-${analytics.days}d.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
  // Rates come from the backend metrics service (OrderMetrics) so Home and Insights
  // share one definition; zero-guards live there, not here.
  const assignedRate = analytics.totals.assignedRate;
  const splitRate = analytics.totals.splitRate;
  const capacityByLocation = new Map(capacity.rows.map((row) => [String(row.id), row]));

  return (
    <s-page heading="Fulfillment analytics" inlineSize="large">
      <s-button slot="secondary-actions" onClick={() => setReloadKey((key) => key + 1)}>Refresh</s-button>
      <s-button slot="secondary-actions" onClick={exportCsv}>Export CSV</s-button>
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

        <s-section heading="Monthly order target">
          <s-stack gap="base">
            {salesTarget.monthly_order_target != null && salesTarget.progress?.current != null ? (
              <s-stack gap="small">
                <s-progress value={salesTarget.progress.current} max={salesTarget.progress.target} tone="success" accessibilityLabel="Monthly order target progress" />
                <s-text>{number(salesTarget.progress.current)} of {number(salesTarget.progress.target)} orders this month · {percent(salesTarget.progress.rate ?? 0)}</s-text>
              </s-stack>
            ) : salesTarget.monthly_order_target != null ? (
              <s-text color="subdued">Target set to {number(salesTarget.monthly_order_target)} orders per month. Live progress is currently unavailable (Shopify order access).</s-text>
            ) : (
              <s-text color="subdued">No target set yet. Set a monthly order goal to track month-to-date progress here.</s-text>
            )}
            <s-stack direction="inline" gap="base" alignItems="end">
              <NumberField label="Orders per month" value={targetDraft} onInput={setTargetDraft} min={1} max={1000000} error={targetError} placeholder="e.g. 500" />
              <s-button variant="primary" loading={targetBusy || undefined} onClick={() => saveTarget(false)}>Save target</s-button>
              {salesTarget.monthly_order_target != null && (
                <s-button variant="tertiary" disabled={targetBusy || undefined} onClick={() => saveTarget(true)}>Clear</s-button>
              )}
            </s-stack>
          </s-stack>
        </s-section>

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

        <s-section heading="Daily breakdown">
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Date</s-table-header>
              <s-table-header>Orders</s-table-header>
              <s-table-header>Assigned</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {analytics.trend.map((row) => (
                <s-table-row key={row.label}>
                  <s-table-cell>{row.label}</s-table-cell>
                  <s-table-cell>{number(row.orders)}</s-table-cell>
                  <s-table-cell>{number(row.assigned)}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>

        <s-section heading="Recent Nexora activity">
          <s-stack gap="base">
            {activity.length === 0 ? (
              <s-paragraph color="subdued">No recorded routing, location or reassignment changes yet.</s-paragraph>
            ) : (
              <s-stack gap="small-300">
                {activity.slice(0, 8).map((event) => (
                  <s-stack key={event.id} direction="inline" gap="base" alignItems="center" justifyContent="space-between">
                    <s-stack direction="inline" gap="small" alignItems="center">
                      <s-badge>{event.typeLabel}</s-badge>
                      <s-text>{event.summary}</s-text>
                    </s-stack>
                    <s-text color="subdued" style={{ whiteSpace: 'nowrap' }}>{dateTime(event.at)}</s-text>
                  </s-stack>
                ))}
              </s-stack>
            )}
            <s-button variant="tertiary" onClick={() => navigate('/activity')}>View all activity</s-button>
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}
