import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api, toast } from '../lib/api.js';
import { html } from '../lib/html.js';
import { plural } from '../lib/format.js';
import { Checkbox, NumberField, SearchField, Select, TextField } from '../components/fields.js';
import { EmptyState, ErrorState, LoadingState } from '../components/states.js';

const TYPES = [
  { value: 'store', label: 'Store' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'third_party', label: 'Third-party fulfillment' },
];

const TABS = [
  ['all', 'All locations'],
  ['untyped', 'Needs a type'],
  ['active', 'Active'],
  ['inactive', 'Inactive'],
  ['store', 'Stores'],
  ['warehouse', 'Warehouses'],
  ['third_party', 'Third-party'],
];

const MODAL_ID = 'nx-location-modal';

const labelFor = (type) => TYPES.find((t) => t.value === type)?.label ?? null;

export function Locations() {
  // The URL is the source of truth for filters, so /locations?tab=untyped deep-links work.
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([key]) => key === params.get('tab')) ? params.get('tab') : 'all';
  const q = params.get('q') ?? '';

  const [data, setData] = useState({ status: 'loading', locations: [], counts: null, syncedAt: null });
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState(() => new Set());
  const [editing, setEditing] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const setFilters = useCallback((next) => {
    const merged = { tab, q, ...next };
    const search = new URLSearchParams();
    if (merged.tab !== 'all') search.set('tab', merged.tab);
    if (merged.q) search.set('q', merged.q);
    setParams(search, { replace: true });
  }, [tab, q, setParams]);

  useEffect(() => {
    let cancelled = false;
    const search = new URLSearchParams({ tab });
    if (q) search.set('q', q);

    api.get(`/locations?${search}`)
      .then((response) => {
        if (cancelled) return;
        setData({ status: 'ready', locations: response.data, counts: response.meta.counts, syncedAt: response.meta.synced_at });
        // Drop selections that are no longer visible.
        setSelected((prev) => new Set([...prev].filter((id) => response.data.some((l) => l.id === id))));
      })
      .catch((error) => {
        if (!cancelled) setData((prev) => ({ ...prev, status: 'error', error }));
      });

    return () => { cancelled = true; };
  }, [tab, q, reloadKey]);

  // Apply a server response for one location without refetching the list.
  const applyLocation = useCallback((updated, counts) => {
    setData((prev) => ({
      ...prev,
      counts: counts ?? prev.counts,
      locations: prev.locations.map((l) => (l.id === updated.id ? updated : l)),
    }));
  }, []);

  async function setType(location, type) {
    applyLocation({ ...location, type: type || null, needs_attention: location.is_active && !type });
    try {
      const response = await api.patch(`/locations/${location.id}`, { type: type || null });
      applyLocation(response.data, response.meta.counts);
      toast(`${location.name} is now ${labelFor(type)?.toLowerCase() ?? 'untyped'}`);
    } catch (error) {
      applyLocation(location); // revert the optimistic change
      toast(error.message, true);
    }
  }

  async function applyBulk(type) {
    try {
      const response = await api.patch('/locations/bulk', { ids: [...selected], type });
      toast(`${plural(response.data.updated, 'location')} set to ${labelFor(type).toLowerCase()}`);
      setSelected(new Set());
      reload();
    } catch (error) {
      toast(error.message, true);
    }
  }

  async function syncNow() {
    setSyncing(true);
    try {
      await api.post('/locations/sync');
      toast('Sync started. Changes from Shopify appear in a few seconds.');
      setTimeout(reload, 4000);
    } catch (error) {
      toast(error.message, true);
    } finally {
      setSyncing(false);
    }
  }

  const toggle = (id, on) => setSelected((prev) => {
    const next = new Set(prev);
    on ? next.add(id) : next.delete(id);
    return next;
  });

  return html`
    <s-page heading="Locations">
      <s-button slot="secondary-actions" loading=${syncing} onClick=${syncNow}>Sync from Shopify</s-button>

      <s-stack direction="block" gap="base">
        <s-paragraph color="subdued">
          These are your Shopify locations. Give each one a type so Nexora knows how to route orders to it.
          Names, addresses and fulfillment settings come from Shopify and stay in sync automatically.
        </s-paragraph>

        <${MissingTypeBanner} counts=${data.counts} tab=${tab} onShow=${() => setFilters({ tab: 'untyped' })} />

        ${selected.size > 0 && html`
          <${BulkBar} count=${selected.size} onApply=${applyBulk} onClear=${() => setSelected(new Set())} />
        `}

        <s-section padding="none">
          <${Filters} tab=${tab} q=${q} counts=${data.counts} onChange=${setFilters} />
          ${data.status === 'loading' && html`<${LoadingState} label="Loading locations…" />`}
          ${data.status === 'error' && html`<s-box padding="base"><${ErrorState} error=${data.error} onRetry=${reload} /></s-box>`}
          ${data.status === 'ready' && (data.locations.length === 0
            ? html`<${LocationsEmpty} tab=${tab} q=${q} syncedAt=${data.syncedAt} setFilters=${setFilters} reload=${reload} />`
            : html`
              <${LocationsTable}
                locations=${data.locations}
                selected=${selected}
                onToggle=${toggle}
                onToggleAll=${(on) => setSelected(on ? new Set(data.locations.map((l) => l.id)) : new Set())}
                onType=${setType}
                onEdit=${setEditing}
              />`)}
        </s-section>

        <${TypeGlossary} />
      </s-stack>

      <${EditLocationModal} location=${editing} onSaved=${applyLocation} />
    </s-page>
  `;
}

function MissingTypeBanner({ counts, tab, onShow }) {
  const untyped = counts?.untyped ?? 0;
  if (untyped === 0) return null;

  return html`
    <s-banner tone="warning" heading=${`${plural(untyped, 'location needs', 'locations need')} a type`}>
      <s-paragraph>
        Nexora can’t route orders to a location until it knows what it is. Pick a type in the table below,
        or tick several locations and set them all at once.
      </s-paragraph>
      ${tab !== 'untyped' && html`<s-button slot="secondary-actions" onClick=${onShow}>Show only these</s-button>`}
    </s-banner>
  `;
}

function Filters({ tab, q, counts, onChange }) {
  const [term, setTerm] = useState(q);
  const timer = useRef(null);

  // Keep the box in sync when the URL changes from elsewhere (e.g. "Clear search").
  useEffect(() => setTerm(q), [q]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const onInput = (value) => {
    setTerm(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange({ q: value.trim() }), 250);
  };

  return html`
    <div className="nx-filters">
      <div className="nx-filters__search">
        <${SearchField} label="Search locations" placeholder="Search by name or address" value=${term} onInput=${onInput} />
      </div>
      <${Select}
        label="Show"
        value=${tab}
        options=${TABS.map(([key, label]) => ({ value: key, label: counts ? `${label} (${counts[key]})` : label }))}
        onChange=${(value) => onChange({ tab: value })}
      />
    </div>
  `;
}

function BulkBar({ count, onApply, onClear }) {
  const [type, setType] = useState('store');
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    setBusy(true);
    await onApply(type);
    setBusy(false);
  };

  return html`
    <s-section>
      <div className="nx-bulk">
        <s-text type="strong">${count} selected</s-text>
        <${Select} label="Set type to" hideLabel value=${type} options=${TYPES} onChange=${setType} />
        <s-button variant="primary" loading=${busy} onClick=${apply}>Apply</s-button>
        <s-button variant="tertiary" onClick=${onClear}>Clear selection</s-button>
      </div>
    </s-section>
  `;
}

function LocationsTable({ locations, selected, onToggle, onToggleAll, onType, onEdit }) {
  const allSelected = locations.every((l) => selected.has(l.id));

  return html`
    <s-table>
      <s-table-header-row>
        <s-table-header>
          <${Checkbox}
            label=${allSelected ? 'Deselect all locations' : 'Select all locations'}
            checked=${allSelected}
            onChange=${onToggleAll}
          />
        </s-table-header>
        <s-table-header listSlot="primary">Location</s-table-header>
        <s-table-header>Type</s-table-header>
        <s-table-header>Fulfills</s-table-header>
        <s-table-header>Limits</s-table-header>
        <s-table-header listSlot="inline">Status</s-table-header>
        <s-table-header><span className="nx-visually-hidden">Actions</span></s-table-header>
      </s-table-header-row>
      <s-table-body>
        ${locations.map((location) => html`
          <s-table-row key=${location.id}>
            <s-table-cell>
              <${Checkbox}
                label=${`Select ${location.name}`}
                checked=${selected.has(location.id)}
                onChange=${(on) => onToggle(location.id, on)}
              />
            </s-table-cell>
            <s-table-cell>
              <s-stack direction="block" gap="small-300">
                <s-text type="strong">${location.name}</s-text>
                ${location.address && html`<s-text color="subdued">${location.address}</s-text>`}
                ${location.managed_by_app && html`<div><s-badge tone="info">Managed by ${location.managed_by_app}</s-badge></div>`}
              </s-stack>
            </s-table-cell>
            <s-table-cell>
              <${Select}
                label=${`Type for ${location.name}`}
                hideLabel
                value=${location.type ?? ''}
                error=${location.needs_attention ? 'Choose a type' : null}
                options=${[{ value: '', label: 'Choose a type…' }, ...TYPES]}
                onChange=${(value) => onType(location, value)}
              />
            </s-table-cell>
            <s-table-cell><${Fulfillment} location=${location} /></s-table-cell>
            <s-table-cell><${Limits} location=${location} /></s-table-cell>
            <s-table-cell>
              ${location.is_active
                ? html`<s-badge tone="success">Active</s-badge>`
                : html`<s-badge tone="neutral">Inactive</s-badge>`}
            </s-table-cell>
            <s-table-cell>
              <s-button
                variant="tertiary"
                commandFor=${MODAL_ID}
                command="--show"
                accessibilityLabel=${`Edit limits and tags for ${location.name}`}
                onClick=${() => onEdit(location)}
              >Edit</s-button>
            </s-table-cell>
          </s-table-row>
        `)}
      </s-table-body>
    </s-table>
  `;
}

function Fulfillment({ location }) {
  if (!location.ships && !location.pickup) {
    return html`<s-text color="subdued">Doesn’t fulfill online orders</s-text>`;
  }

  return html`
    <s-stack direction="inline" gap="small-200">
      ${location.ships && html`<s-badge>Ships orders</s-badge>`}
      ${location.pickup && html`<s-badge>Local pickup</s-badge>`}
    </s-stack>
  `;
}

function Limits({ location }) {
  if (!location.daily_order_cap && !location.backlog_cap) {
    return html`<s-text color="subdued">No limit</s-text>`;
  }

  return html`
    <s-stack direction="block" gap="small-300">
      ${location.daily_order_cap && html`<s-text>${location.daily_order_cap.toLocaleString()} orders / day</s-text>`}
      ${location.backlog_cap && html`<s-text color="subdued">Backlog max ${location.backlog_cap.toLocaleString()}</s-text>`}
    </s-stack>
  `;
}

function LocationsEmpty({ tab, q, syncedAt, setFilters, reload }) {
  if (q) {
    return html`<${EmptyState}
      heading="No locations match your search"
      text=${`Nothing matches “${q}”. Try a different name or address.`}
      action=${{ label: 'Clear search', onClick: () => setFilters({ q: '' }) }}
    />`;
  }
  if (tab === 'untyped') {
    return html`<${EmptyState}
      heading="Every active location has a type"
      text="Nice work. Nexora can route orders to all of your active locations."
      action=${{ label: 'Show all locations', onClick: () => setFilters({ tab: 'all' }) }}
    />`;
  }
  if (tab !== 'all') {
    return html`<${EmptyState}
      heading="No locations in this view"
      text="Try another filter, or set a location’s type to see it here."
      action=${{ label: 'Show all locations', onClick: () => setFilters({ tab: 'all' }) }}
    />`;
  }
  return html`<${EmptyState}
    heading=${syncedAt ? 'No locations found' : 'Importing your locations…'}
    text=${syncedAt
      ? 'Add a location in Shopify (Settings → Locations) and it will show up here automatically.'
      : 'Nexora is reading your locations from Shopify. This usually takes a few seconds.'}
    action=${{ label: 'Refresh', onClick: reload }}
  />`;
}

/** Always mounted: Polaris opens it via commandFor on the row's Edit button. */
function EditLocationModal({ location, onSaved }) {
  const modal = useRef(null);
  const [form, setForm] = useState({ daily: '', backlog: '', tags: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!location) return;
    setForm({
      daily: location.daily_order_cap ?? '',
      backlog: location.backlog_cap ?? '',
      tags: (location.tags ?? []).join(', '),
    });
    setErrors({});
  }, [location]);

  const toInt = (v) => (String(v ?? '').trim() === '' ? null : Number(v));

  async function save() {
    if (!location) return;
    setSaving(true);
    try {
      const response = await api.patch(`/locations/${location.id}`, {
        daily_order_cap: toInt(form.daily),
        backlog_cap: toInt(form.backlog),
        tags: String(form.tags).split(',').map((t) => t.trim()).filter(Boolean),
      });
      onSaved(response.data, response.meta.counts);
      modal.current?.hideOverlay();
      toast(`${location.name} updated`);
    } catch (error) {
      const fields = error.fieldErrors ?? {};
      setErrors({
        daily: fields.daily_order_cap,
        backlog: fields.backlog_cap,
        tags: Object.entries(fields).find(([key]) => key.startsWith('tags'))?.[1],
      });
      if (!Object.keys(fields).length) toast(error.message, true);
    } finally {
      setSaving(false);
    }
  }

  return html`
    <s-modal ref=${modal} id=${MODAL_ID} heading=${location ? `Edit ${location.name}` : 'Edit location'}>
      <s-stack direction="block" gap="base">
        <s-banner tone="info">
          <s-paragraph>Limits are saved now and start taking effect when capacity routing launches in the next release.</s-paragraph>
        </s-banner>
        <${NumberField}
          label="Daily order limit"
          placeholder="No limit"
          value=${String(form.daily)}
          error=${errors.daily}
          details="The most new orders this location should receive per day. Leave empty for no limit."
          onInput=${(daily) => setForm((f) => ({ ...f, daily }))}
        />
        <${NumberField}
          label="Backlog limit"
          placeholder="No limit"
          value=${String(form.backlog)}
          error=${errors.backlog}
          details="The most unfulfilled orders that can wait at this location at once. Leave empty for no limit."
          onInput=${(backlog) => setForm((f) => ({ ...f, backlog }))}
        />
        <${TextField}
          label="Tags"
          placeholder="e.g. fragile, north, flagship"
          value=${form.tags}
          error=${errors.tags}
          details="Separate tags with commas. You’ll use them in routing rules, like “only ship fragile items from locations tagged fragile”."
          onInput=${(tags) => setForm((f) => ({ ...f, tags }))}
        />
      </s-stack>
      <s-button slot="secondary-actions" commandFor=${MODAL_ID} command="--hide">Cancel</s-button>
      <s-button slot="primary-action" variant="primary" loading=${saving} onClick=${save}>Save</s-button>
    </s-modal>
  `;
}

function TypeGlossary() {
  const items = [
    ['Store', 'A shop customers can walk into. Can ship online orders and offer local pickup, and usually needs some stock protected for walk-in customers.'],
    ['Warehouse', 'A stock-holding location you run yourself. Usually the first choice for shipping online orders.'],
    ['Third-party fulfillment', 'A location run by a fulfillment app or 3PL partner. Nexora detects these automatically and marks them for you.'],
  ];

  return html`
    <s-section heading="What do the types mean?">
      <div className="nx-how">
        ${items.map(([title, text]) => html`
          <s-stack key=${title} direction="block" gap="small-200">
            <s-heading>${title}</s-heading>
            <s-paragraph color="subdued">${text}</s-paragraph>
          </s-stack>
        `)}
      </div>
    </s-section>
  `;
}
