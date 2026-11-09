import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { api, toast } from '../lib/api.js';
import { locationsService } from '../services/locations.js';
import { capacityService } from '../services/capacity.js';
import { ErrorState, LoadingState } from '../components/states.jsx';
import { DetailList, StatusBadge } from '../components/ui.jsx';
import { Meter } from '../components/charts.jsx';
import { NumberField, TextField } from '../components/fields.jsx';
import { number, percent } from '../lib/format.js';

const MODAL_ID = 'nx-location-detail-edit';
const TYPE_LABELS = {
  store: 'Store',
  warehouse: 'Warehouse',
  third_party: 'Third-party fulfillment',
};

export default function LocationDetail() {
  const { locationId } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      locationsService.get(locationId),
      capacityService.overview(),
      api.get('/dashboard?days=30'),
    ])
      .then(([location, capacity, dashboard]) => {
        if (cancelled) return;
        if (!location) { setState({ status: 'missing' }); return; }
        const capacityRow = capacity.rows.find((row) => String(row.id) === location.id) ?? null;
        const orderStats = dashboard.data.distribution.find((row) => row.id === location.id) ?? null;
        setState({ status: 'ready', location, capacity: capacityRow, orderStats });
      })
      .catch((error) => !cancelled && setState({ status: 'error', error }));
    return () => { cancelled = true; };
  }, [locationId, reloadKey]);

  if (state.status === 'loading') return <s-page heading="Location" inlineSize="large"><LoadingState label="Loading live location data…" /></s-page>;
  if (state.status === 'error') return <s-page heading="Location" inlineSize="large"><ErrorState error={state.error} onRetry={() => setReloadKey((key) => key + 1)} /></s-page>;
  if (state.status === 'missing') {
    return (
      <s-page heading="Location not found" inlineSize="large">
        <s-section>
          <s-stack gap="base">
            <s-paragraph>This location is not present in Nexora’s synced Shopify locations.</s-paragraph>
            <s-button variant="primary" onClick={() => navigate('/locations')}>Back to locations</s-button>
          </s-stack>
        </s-section>
      </s-page>
    );
  }

  const { location, capacity, orderStats } = state;
  const utilization = capacity?.utilization ?? null;
  const atRisk = ['watch', 'overload'].includes(capacity?.forecast);

  return (
    <s-page heading={location.name} inlineSize="large">
      <s-button slot="secondary-actions" onClick={() => navigate('/locations')}>Back to locations</s-button>
      <s-button slot="secondary-actions" commandFor={MODAL_ID} command="--show">Edit Nexora limits</s-button>

      <s-stack gap="base">
        <s-stack direction="inline" gap="small" alignItems="center">
          <s-badge icon={location.type === 'warehouse' ? 'inventory' : location.type === 'store' ? 'store' : 'store-managed'}>
            {TYPE_LABELS[location.type] ?? 'Unclassified'}
          </s-badge>
          {location.active ? <s-badge tone="success" icon="status-active">Active</s-badge> : <s-badge tone="neutral">Inactive</s-badge>}
          {location.managedBy && <s-badge tone="info" icon="store-managed">Managed by {location.managedBy}</s-badge>}
        </s-stack>

        {atRisk && (
          <s-banner tone="warning" heading={capacity.forecast === 'overload' ? 'Daily limit reached or nearly reached' : 'This location is nearing its daily limit'}>
            <s-paragraph>{percent(utilization)} of {number(location.dailyCap)} configured daily orders are currently assigned.</s-paragraph>
          </s-banner>
        )}

        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(300px, 1fr))" gap="base">
          <s-section heading="Live capacity today">
            <s-stack gap="base">
              <DetailList rows={[
                ['Daily order limit', location.dailyCap == null ? 'Not configured' : number(location.dailyCap)],
                ['Currently assigned today', number(capacity?.ordersToday ?? 0)],
                ['Remaining configured capacity', capacity?.remaining == null ? '—' : number(capacity.remaining)],
                ['Backlog', 'Not tracked by the current integration'],
              ]} />
              {utilization !== null && (
                <s-stack gap="small-300">
                  <s-stack direction="inline" justifyContent="space-between">
                    <s-text color="subdued">Daily limit used</s-text>
                    <s-text>{percent(utilization)}</s-text>
                  </s-stack>
                  <Meter value={utilization} label="Daily capacity used" />
                </s-stack>
              )}
            </s-stack>
          </s-section>

          <s-section heading="Shopify location details">
            <DetailList rows={[
              ['Address', location.address || [location.city, location.countryCode].filter(Boolean).join(', ') || 'Not provided'],
              ['Ships orders', location.ships ? 'Yes' : 'No'],
              ['Local pickup', location.pickup ? 'Yes' : 'No'],
              ['Supported tags', location.tags.length ? location.tags.join(', ') : 'None configured'],
              ['Orders assigned in last 30 days', number(orderStats?.value ?? 0)],
              ['Fulfilled in that period', number(orderStats?.fulfilled ?? 0)],
            ]} />
          </s-section>
        </s-grid>

        <s-section heading="Assignment data">
          <s-paragraph>
            Last-30-day counts use the location currently assigned to each Shopify order. They do not represent historical routing decisions, shipments completed at this location, or carrier costs.
          </s-paragraph>
          <s-button onClick={() => navigate('/orders')}>Review Shopify orders</s-button>
        </s-section>
      </s-stack>

      <EditModal
        location={location}
        onSaved={(updated) => {
          setState((current) => ({ ...current, location: updated }));
          setReloadKey((key) => key + 1);
        }}
      />
    </s-page>
  );
}

function EditModal({ location, onSaved }) {
  const modal = useRef(null);
  const [form, setForm] = useState({ dailyCap: '', backlogCap: '', tags: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      dailyCap: location.dailyCap == null ? '' : String(location.dailyCap),
      backlogCap: location.backlogCap == null ? '' : String(location.backlogCap),
      tags: location.tags.join(', '),
    });
  }, [location]);

  async function save() {
    setSaving(true);
    try {
      const updated = await locationsService.update(location.id, {
        daily_order_cap: form.dailyCap === '' ? null : Number(form.dailyCap),
        backlog_cap: form.backlogCap === '' ? null : Number(form.backlogCap),
        tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      });
      onSaved(updated);
      modal.current?.hideOverlay();
      toast(`${location.name} limits updated`);
    } catch (error) {
      toast(error.message, true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <s-modal ref={modal} id={MODAL_ID} heading={`Edit ${location.name}`}>
      <s-stack gap="base">
        <s-banner tone="info">
          <s-paragraph>These limits and tags are stored by Nexora. Shopify owns the location’s active status and address.</s-paragraph>
        </s-banner>
        <NumberField label="Daily order limit" value={form.dailyCap} min={1} max={100000} onInput={(dailyCap) => setForm((current) => ({ ...current, dailyCap }))} />
        <NumberField label="Backlog limit" value={form.backlogCap} min={1} max={100000} onInput={(backlogCap) => setForm((current) => ({ ...current, backlogCap }))} />
        <TextField label="Supported tags" value={form.tags} placeholder="e.g. fragile, apparel" details="Separate with commas." onInput={(tags) => setForm((current) => ({ ...current, tags }))} />
      </s-stack>
      <s-button slot="secondary-actions" commandFor={MODAL_ID} command="--hide">Cancel</s-button>
      <s-button slot="primary-action" variant="primary" loading={saving} onClick={save}>Save</s-button>
    </s-modal>
  );
}
