import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { capacityService } from '../services/capacity.js';
import { LOCATION_TYPE_LABEL } from '../mocks/seed.js';
import { number, percent } from '../lib/format.js';
import { ErrorState, LoadingState, EmptyState } from '../components/states.jsx';
import { KpiCard, StatusBadge } from '../components/ui.jsx';
import { BarChart, Meter } from '../components/charts.jsx';

export default function Capacity() {
  const navigate = useNavigate();
  const [state, setState] = useState({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    capacityService.overview()
      .then((data) => !cancelled && setState({ status: 'ready', data }))
      .catch((error) => !cancelled && setState({ status: 'error', error }));
    setRefreshing(false);
    return () => { cancelled = true; };
  }, [reloadKey]);

  if (state.status === 'loading') return <s-page heading="Capacity" inlineSize="large"><LoadingState label="Loading location capacity…" /></s-page>;
  if (state.status === 'error') return <s-page heading="Capacity" inlineSize="large"><ErrorState error={state.error} onRetry={() => setReloadKey((key) => key + 1)} /></s-page>;

  const { totals, rows, asOf, timezone } = state.data;
  return (
    <s-page heading="Capacity" inlineSize="large">
      <s-button slot="secondary-actions" loading={refreshing} onClick={() => { setRefreshing(true); setReloadKey((key) => key + 1); }}>Refresh</s-button>
      <s-button slot="secondary-actions" onClick={() => navigate('/locations')}>Manage locations</s-button>
      <s-stack gap="base">
        <s-banner tone="info" heading="Live Shopify order counts">
          <s-paragraph>Counts include non-cancelled orders created today in the shop’s timezone, grouped by their current Shopify fulfillment location. Backlog history and demand forecasts are not included. Capacity limits are configured per location in Nexora.</s-paragraph>
        </s-banner>

        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(210px, 1fr))" gap="base">
          <KpiCard label="Orders assigned today" value={number(totals.ordersToday)} help="Live Shopify orders by current fulfillment assignment" />
          <KpiCard label="Configured capacity utilization" value={totals.utilization == null ? '—' : percent(totals.utilization)} help="Across locations with a daily order limit configured" />
          <KpiCard label="Locations to watch" value={number(totals.atRisk)} help="At or above 75% utilization" />
          <KpiCard label="Locations without a daily limit" value={number(totals.unconfigured)} help="Set limits from location details" />
        </s-grid>

        <s-section heading="Orders assigned today by location">
          <s-stack gap="base">
            <s-text color="subdued">Live, non-cancelled Shopify orders created today. Refreshed at {new Date(asOf).toLocaleTimeString([], { timeZone: timezone })} ({timezone}).</s-text>
            <BarChart data={rows.map((row) => ({ label: row.name, value: row.ordersToday }))} format={(value) => number(value)} />
          </s-stack>
        </s-section>

        <s-section heading="Location capacity">
          {rows.length === 0 ? <EmptyState heading="No locations available" text="Add or sync locations to review fulfillment capacity." action={{ label: 'Open locations', onClick: () => navigate('/locations') }} /> : (
            <s-table>
              <s-table-header-row>
                <s-table-header listSlot="primary">Location</s-table-header>
                <s-table-header>Type</s-table-header>
                <s-table-header>Orders today</s-table-header>
                <s-table-header>Daily limit</s-table-header>
                <s-table-header>Remaining</s-table-header>
                <s-table-header>Utilization</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {rows.map((row) => (
                  <s-table-row key={row.id}>
                    <s-table-cell><s-clickable onClick={() => navigate(`/locations/${row.id}`)}><s-text type="strong">{row.name}</s-text></s-clickable></s-table-cell>
                    <s-table-cell>{LOCATION_TYPE_LABEL[row.type] ?? 'Unclassified'}</s-table-cell>
                    <s-table-cell>{number(row.ordersToday)}</s-table-cell>
                    <s-table-cell>{row.dailyCap == null ? 'Not set' : number(row.dailyCap)}</s-table-cell>
                    <s-table-cell>{row.remaining == null ? '—' : number(row.remaining)}</s-table-cell>
                    <s-table-cell>
                      <s-stack gap="small-300">
                        <s-stack direction="inline" gap="small" alignItems="center" justifyContent="space-between">
                          <s-text>{row.utilization == null ? '—' : percent(row.utilization)}</s-text>
                          <StatusBadge kind="forecast" value={row.forecast} />
                        </s-stack>
                        {row.utilization != null && <Meter value={row.utilization} label={`${row.name} utilization`} />}
                      </s-stack>
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          )}
        </s-section>
      </s-stack>
    </s-page>
  );
}
