import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ordersService } from '../services/orders.js';
import { money, number, date } from '../lib/format.js';
import { ErrorState, LoadingState, EmptyState } from '../components/states.jsx';
import { StatusBadge } from '../components/ui.jsx';
import { SearchField, Select } from '../components/fields.jsx';
import { toast } from '../lib/api.js';

const locName = (id, locations) => locations.find((location) => String(location.id) === String(id))?.name ?? '—';
const PAGE_SIZE = 8;

const FULFIL_OPTS = [['all', 'All fulfillment'], ['fulfilled', 'Fulfilled'], ['pending', 'Fulfillment pending'], ['unfulfilled', 'Unfulfilled'], ['cancelled', 'Cancelled']];
const SORT_OPTS = [['date_desc', 'Newest first'], ['date_asc', 'Oldest first'], ['cost_desc', 'Highest ship cost'], ['cost_asc', 'Lowest ship cost']];
const RANGE_OPTS = [['all', 'Any date'], ['7', 'Last 7 days'], ['14', 'Last 14 days'], ['30', 'Last 30 days']];

export default function Orders() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState({ status: 'loading' });
  const [page, setPage] = useState(0);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Filters live in the URL so views can be bookmarked and shared.
  const q = params.get('q') ?? '';
  const fulfillment = params.get('fulfillment') ?? 'all';
  const location = params.get('location') ?? 'all';
  const range = params.get('range') ?? 'all';
  const sort = params.get('sort') ?? 'date_desc';

  const setFilter = (patch) => {
    const next = new URLSearchParams(params);
    next.delete('status');
    Object.entries(patch).forEach(([k, v]) => { if (!v || v === 'all') next.delete(k); else next.set(k, v); });
    setParams(next, { replace: true });
    setPage(0);
  };

  useEffect(() => {
    let cancelled = false;
    ordersService.list()
      .then((result) => !cancelled && setState({ status: 'ready', ...result }))
      .catch((error) => !cancelled && setState({ status: 'error', error }));
    return () => { cancelled = true; };
  }, [reloadKey]);

  async function loadOlder() {
    if (state.status !== 'ready' || !state.pageInfo?.has_next_page || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const result = await ordersService.list(state.pageInfo.end_cursor);
      setState((current) => current.status === 'ready'
        ? {
          ...current,
          orders: [...current.orders, ...result.orders],
          locations: result.locations,
          pageInfo: result.pageInfo,
        }
        : current);
    } catch (error) {
      toast(error.message, true);
    } finally {
      setLoadingOlder(false);
    }
  }

  const filtered = useMemo(() => {
    if (state.status !== 'ready') return [];
    const now = Date.now();
    const days = range === 'all' ? Infinity : Number(range);
    let list = state.orders.filter((o) => {
      if (q && !o.number.toLowerCase().includes(q.toLowerCase())) return false;
      if (fulfillment !== 'all' && o.fulfillmentStatus !== fulfillment) return false;
      if (location !== 'all' && String(o.assignedLocationId) !== location) return false;
      if (days !== Infinity && (now - new Date(o.date).getTime()) > days * 86_400_000) return false;
      return true;
    });
    const dir = sort.endsWith('asc') ? 1 : -1;
    list = [...list].sort((a, b) => (sort.startsWith('cost')
      ? dir * ((a.shippingEstimate ?? 0) - (b.shippingEstimate ?? 0))
      : dir * (new Date(a.date) - new Date(b.date))));
    return list;
  }, [state, q, fulfillment, location, range, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  if (state.status === 'loading') return <s-page heading="Orders" inlineSize="large"><LoadingState label="Loading Shopify orders…" /></s-page>;
  if (state.status === 'error') return <s-page heading="Orders" inlineSize="large"><ErrorState error={state.error} onRetry={() => setReloadKey((k) => k + 1)} /></s-page>;

  return (
    <s-page heading="Orders" inlineSize="large">
      <s-stack gap="base">
        <s-banner tone="info"><s-paragraph>Live Shopify orders from the most recent 60 days. The newest 20 load first; use “Load older orders” to browse more. Customer identity is not loaded. Manual reassignment is available from eligible, unfulfilled single-location order details; automated routing decisions are not recorded yet.</s-paragraph></s-banner>

        <s-section padding="none">
          <s-box padding="base">
            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(170px, 1fr))" gap="base" alignItems="end">
              <SearchField label="Search order number" placeholder="Order number" value={q} onInput={(v) => setFilter({ q: v.trim() })} />
              <Select label="Fulfillment" value={fulfillment} options={FULFIL_OPTS.map(([value, label]) => ({ value, label }))} onChange={(v) => setFilter({ fulfillment: v })} />
              <Select label="Location" value={location} options={[{ value: 'all', label: 'All locations' }, ...state.locations.map((l) => ({ value: String(l.id), label: l.name }))]} onChange={(v) => setFilter({ location: v })} />
              <Select label="Date" value={range} options={RANGE_OPTS.map(([value, label]) => ({ value, label }))} onChange={(v) => setFilter({ range: v })} />
              <Select label="Sort" value={sort} options={SORT_OPTS.map(([value, label]) => ({ value, label }))} onChange={(v) => setFilter({ sort: v })} />
            </s-grid>
          </s-box>

          {filtered.length === 0 ? (
            <EmptyState icon="order" heading="No orders match" text="Try clearing a filter or searching a different order number." action={{ label: 'Clear filters', onClick: () => setParams(new URLSearchParams(), { replace: true }) }} />
          ) : (
            <OrdersTable
              rows={pageRows}
              locations={state.locations}
              onOpen={(id) => navigate(`/orders/${id}`)}
              onActivity={(orderNumber) => navigate(`/activity?q=${encodeURIComponent(orderNumber)}`)}
            />
          )}
        </s-section>

        {filtered.length > PAGE_SIZE && (
          <s-stack direction="inline" gap="base" alignItems="center" justifyContent="center">
            <s-button variant="tertiary" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</s-button>
            <s-text color="subdued">{current * PAGE_SIZE + 1}–{Math.min(filtered.length, (current + 1) * PAGE_SIZE)} of {filtered.length}</s-text>
            <s-button variant="tertiary" disabled={current >= pageCount - 1} onClick={() => setPage(current + 1)}>Next</s-button>
          </s-stack>
        )}

        {state.pageInfo?.has_next_page && (
          <s-stack direction="inline" gap="base" alignItems="center" justifyContent="center">
            <s-text color="subdued">{number(state.orders.length)} live orders loaded</s-text>
            <s-button variant="secondary" loading={loadingOlder} onClick={loadOlder}>Load older orders</s-button>
          </s-stack>
        )}
      </s-stack>
    </s-page>
  );
}

function OrdersTable({ rows, locations, onOpen, onActivity }) {
  return (
    <s-table>
      <s-table-header-row>
        <s-table-header listSlot="primary">Order</s-table-header>
        <s-table-header>Date</s-table-header>
        <s-table-header>Destination</s-table-header>
        <s-table-header>Items</s-table-header>
        <s-table-header>Location</s-table-header>
        <s-table-header>Ship cost</s-table-header>
        <s-table-header>Routing</s-table-header>
        <s-table-header>Nexora routing</s-table-header>
        <s-table-header listSlot="inline">Fulfillment</s-table-header>
      </s-table-header-row>
      <s-table-body>
        {rows.map((o) => (
          <s-table-row key={o.id}>
            <s-table-cell>
              <s-clickable onClick={() => onOpen(o.id)}><s-text type="strong">{o.number}</s-text></s-clickable>
            </s-table-cell>
            <s-table-cell>{date(o.date)}</s-table-cell>
            <s-table-cell>{o.destination.city || '—'}{o.destination.country ? `, ${o.destination.country}` : ''}</s-table-cell>
            <s-table-cell>
              <s-stack direction="inline" gap="small-300" alignItems="center">
                <s-text>{o.itemCount}</s-text>
                {o.split && <s-badge tone="info" icon="transfer">Split</s-badge>}
              </s-stack>
            </s-table-cell>
            <s-table-cell>{o.assignedLocationName ?? (o.assignedLocationId ? locName(o.assignedLocationId, locations) : 'Unassigned')}</s-table-cell>
            <s-table-cell><s-text style={{ fontVariantNumeric: 'tabular-nums' }}>{o.shippingEstimate != null ? money(o.shippingEstimate, { currency: o.currency, cents: true }) : '—'}</s-text></s-table-cell>
            <s-table-cell><s-clickable onClick={() => onActivity(o.number)}><s-text>View activity</s-text></s-clickable></s-table-cell>
            <s-table-cell><StatusBadge kind="fulfillment" value={o.fulfillmentStatus} /></s-table-cell>
          </s-table-row>
        ))}
      </s-table-body>
    </s-table>
  );
}
