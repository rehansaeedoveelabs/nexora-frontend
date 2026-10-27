import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, api, toast } from '../lib/api.js';
import { splitTags } from '../lib/format.js';
import { Select, Switch, TextField } from '../components/fields.jsx';
import { Card, EmptyState, ErrorState, LoadingState } from '../components/states.jsx';
import { Simulator } from '../components/Simulator.jsx';

const SAVE_BAR_ID = 'nexora-routing-save-bar';

const TYPE_TARGETS = [
  { value: 'warehouse', label: 'Warehouses' },
  { value: 'store', label: 'Stores' },
  { value: 'third_party', label: 'Third-party' },
];

const LOCAL_OPTIONS = [
  { value: '', label: 'Don’t prefer nearby locations' },
  { value: 'country', label: 'Prefer locations in the customer’s country' },
  { value: 'province', label: 'Prefer locations in the customer’s state or province' },
];

const newId = () => (globalThis.crypto?.randomUUID?.() ?? `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

// The UI keeps the raw tag text (so typing "fragile, " works); the API gets arrays.
const toDraft = (settings) => ({
  ...settings,
  rules: settings.rules.map((rule) => ({ ...rule, tagsText: rule.tags.join(', ') })),
});

const toPayload = (draft) => ({
  priority: draft.priority,
  prefer_local: draft.prefer_local || null,
  no_split: draft.no_split,
  rules: draft.rules.map(({ tagsText, ...rule }) => ({ ...rule, tags: splitTags(tagsText) })),
});

// App Bridge's contextual save bar (the black bar Shopify shows for unsaved settings). Guarded so
// the app still works if App Bridge isn't present (e.g. the E2E stub).
const saveBar = {
  show: () => window.shopify?.saveBar?.show?.(SAVE_BAR_ID),
  hide: () => window.shopify?.saveBar?.hide?.(SAVE_BAR_ID),
};

export default function Routing() {
  const [state, setState] = useState({ status: 'loading' });
  const [draft, setDraft] = useState(null);
  const [saved, setSaved] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.get('/routing')
      .then(({ data }) => {
        if (cancelled) return;
        setState({ status: 'ready', ...data });
        setDraft(toDraft(data.settings));
        setSaved(toPayload(toDraft(data.settings)));
      })
      .catch((error) => !cancelled && setState({ status: 'error', error }));
    return () => { cancelled = true; };
  }, [reloadKey]);

  const dirty = useMemo(() => draft && saved && JSON.stringify(toPayload(draft)) !== JSON.stringify(saved), [draft, saved]);
  const update = useCallback((patch) => setDraft((d) => ({ ...d, ...patch })), []);

  // Drive the contextual save bar from the dirty state, and hide it when leaving the page.
  useEffect(() => {
    if (dirty) saveBar.show(); else saveBar.hide();
  }, [dirty]);
  useEffect(() => () => saveBar.hide(), []);

  const discard = useCallback(() => {
    setDraft(toDraft(state.settings));
    setErrors({});
  }, [state.settings]);

  async function save() {
    setSaving(true);
    setErrors({});
    try {
      const { data } = await api.put('/routing', toPayload(draft));
      setState((s) => ({ ...s, ...data }));
      setDraft(toDraft(data.settings));
      setSaved(toPayload(toDraft(data.settings)));
      saveBar.hide();
      toast('Routing saved');
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) setErrors(error.fieldErrors);
      toast(error.status === 422 ? 'Fix the highlighted fields, then save again.' : error.message, true);
    } finally {
      setSaving(false);
    }
  }

  if (state.status === 'loading') return <s-page heading="Routing" inlineSize="large"><LoadingState label="Loading routing…" /></s-page>;
  if (state.status === 'error') {
    return <s-page heading="Routing" inlineSize="large"><ErrorState error={state.error} onRetry={() => setReloadKey((k) => k + 1)} /></s-page>;
  }

  const locationsById = Object.fromEntries(state.locations.map((l) => [l.id, l]));

  return (
    <s-page heading="Routing" inlineSize="large">
      {/* Shopify's contextual save bar. App Bridge floats it at the top of the admin when shown. */}
      <ui-save-bar id={SAVE_BAR_ID}>
        <button variant="primary" onClick={save} {...(saving ? { loading: '' } : {})}>Save</button>
        <button onClick={discard} {...(saving ? { disabled: '' } : {})}>Discard</button>
      </ui-save-bar>

      <s-stack gap="large">
        <s-paragraph color="subdued">
          Decide which location ships each order. Test any change with a sample order at the bottom of this page before you save it.
        </s-paragraph>

        <s-banner tone="info" heading="Rules are saved and testable now">
          <s-paragraph>
            They start applying to real checkouts when Nexora’s checkout integration is switched on in the next release.
            Until then, your orders route exactly as they do today.
          </s-paragraph>
        </s-banner>

        {state.warnings.map((w) => (
          <s-banner key={w.code + (w.rule_id ?? '')} tone={w.tone}>
            <s-paragraph>{w.message}</s-paragraph>
          </s-banner>
        ))}

        <PrioritySection
          priority={draft.priority}
          locationsById={locationsById}
          notShipping={state.not_shipping}
          isPlus={state.plan.is_plus}
          onChange={(priority) => update({ priority })}
        />

        <s-section heading="Nearby locations">
          <Select
            label="When a customer orders"
            value={draft.prefer_local ?? ''}
            options={LOCAL_OPTIONS}
            details="Nearby locations are tried before the rest, keeping your priority order within each group. Shorter distances usually mean faster, cheaper delivery."
            onChange={(value) => update({ prefer_local: value || null })}
          />
        </s-section>

        <s-section heading="Keep orders together">
          <Switch
            label="Ship every order from a single location"
            details="Customers get one package instead of several. If no single location has everything, checkout shows no shipping rates for that order, so check your stock before turning this on."
            checked={draft.no_split}
            onChange={(no_split) => update({ no_split })}
          />
        </s-section>

        <RulesSection
          rules={draft.rules}
          locations={state.locations}
          errors={errors}
          onChange={(rules) => update({ rules })}
        />

        <Simulator locations={state.locations} draftPayload={toPayload(draft)} isPlus={state.plan.is_plus} />
      </s-stack>
    </s-page>
  );
}

function PrioritySection({ priority, locationsById, notShipping, isPlus, onChange }) {
  // Only ids that are still shipping locations are shown and moved (stale ids are dropped).
  const rows = priority.map((id) => locationsById[id]).filter(Boolean);

  const move = (index, delta) => {
    // Guard: a double-click or a click on a just-disabled button must never move past either end.
    if (index + delta < 0 || index + delta >= rows.length) return;
    const next = rows.map((l) => l.id);
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange(next);
  };

  return (
    <s-section heading="Location priority">
      <s-stack gap="base">
        <s-paragraph color="subdued">
          When several locations can ship an order, the one higher on this list is used first.
          Locations that are out of stock or blocked by a rule are skipped automatically.
        </s-paragraph>

        {!isPlus && (
          <s-banner tone="info">
            <s-paragraph>
              Shopify only lets apps enforce this order at checkout on Shopify Plus. On your plan, Shopify chooses between the
              locations that pass your rules using your Shopify order routing settings. Your product rules and
              “keep orders together” still apply on every plan.
            </s-paragraph>
          </s-banner>
        )}

        <Card padding="none">
          {rows.map((location, index) => (
            <Fragment key={location.id}>
              {index > 0 && <s-divider />}
              <s-box padding="base">
                <s-grid gridTemplateColumns="auto 1fr auto auto" gap="base" alignItems="center">
                  <s-box padding="small-200" background="subdued" borderRadius="base">
                    <s-text type="strong">{index + 1}</s-text>
                  </s-box>
                  <s-stack gap="small-300">
                    <s-text type="strong">{location.name}</s-text>
                    <s-text color="subdued">{location.address ?? location.country_code ?? ''}</s-text>
                  </s-stack>
                  {location.type_label
                    ? <s-badge icon={location.type === 'warehouse' ? 'inventory' : location.type === 'store' ? 'store' : 'store-managed'}>{location.type_label}</s-badge>
                    : <s-badge tone="warning" icon="alert-triangle">No type</s-badge>}
                  <s-stack direction="inline" gap="small-300">
                    <s-button
                      variant="tertiary"
                      icon="arrow-up"
                      disabled={index === 0}
                      accessibilityLabel={`Move ${location.name} up`}
                      onClick={() => move(index, -1)}
                    />
                    <s-button
                      variant="tertiary"
                      icon="arrow-down"
                      disabled={index === rows.length - 1}
                      accessibilityLabel={`Move ${location.name} down`}
                      onClick={() => move(index, 1)}
                    />
                  </s-stack>
                </s-grid>
              </s-box>
            </Fragment>
          ))}
        </Card>

        {notShipping.length > 0 && (
          <s-paragraph color="subdued">
            Not used for online orders: {notShipping.join(', ')}. To include {notShipping.length === 1 ? 'it' : 'them'},
            turn on “Fulfill online orders” for the location in Shopify settings.
          </s-paragraph>
        )}
      </s-stack>
    </s-section>
  );
}

function RulesSection({ rules, locations, errors, onChange }) {
  const set = (index, patch) => onChange(rules.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  const add = () => onChange([...rules, {
    id: newId(), enabled: true, tagsText: '', tags: [], action: 'only_from', location_types: ['warehouse'], location_ids: [],
  }]);

  return (
    <s-section heading="Product rules">
      <s-stack gap="base">
        <s-paragraph color="subdued">
          Control where specific products ship from, using the product tags you already set in Shopify.
          Rules apply on every Shopify plan.
        </s-paragraph>

        {rules.length === 0 && (
          <EmptyState
            icon="filter"
            heading="No product rules yet"
            text="For example: only ship products tagged “fragile” from your warehouses, where they’re packed properly."
          />
        )}

        {rules.map((rule, index) => (
          <RuleCard
            key={rule.id}
            rule={rule}
            index={index}
            locations={locations}
            errors={errors}
            onChange={(patch) => set(index, patch)}
            onDelete={() => onChange(rules.filter((_, i) => i !== index))}
          />
        ))}

        <s-stack direction="inline"><s-button icon="plus" onClick={add}>Add a rule</s-button></s-stack>
      </s-stack>
    </s-section>
  );
}

function RuleCard({ rule, index, locations, errors, onChange, onDelete }) {
  const toggleIn = (list, value, on) => (on ? [...new Set([...list, value])] : list.filter((v) => v !== value));
  const tags = splitTags(rule.tagsText);
  const resolved = locations.filter((l) => rule.location_types.includes(l.type) || rule.location_ids.includes(l.id));
  const err = (field) => errors[`rules.${index}.${field}`];

  return (
    <Card subdued={!rule.enabled}>
      <s-stack gap="base">
        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-icon type="filter" tone="subdued" />
            <s-text type="strong">Rule {index + 1}{rule.enabled ? '' : ' (off)'}</s-text>
          </s-stack>
          <s-stack direction="inline" gap="base" alignItems="center">
            <Switch label="On" checked={rule.enabled} onChange={(enabled) => onChange({ enabled })} />
            <s-button variant="tertiary" tone="critical" icon="delete" accessibilityLabel={`Delete rule ${index + 1}`} onClick={onDelete} />
          </s-stack>
        </s-stack>

        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(240px, 1fr))" gap="base" alignItems="start">
          <TextField
            label="When an order contains products tagged"
            placeholder="e.g. fragile, glass"
            value={rule.tagsText}
            error={err('tags') ?? err('tags.0')}
            details="Separate tags with commas. A product needs any one of them."
            onInput={(tagsText) => onChange({ tagsText })}
          />
          <Select
            label="Then"
            value={rule.action}
            options={[{ value: 'only_from', label: 'Only ship them from' }, { value: 'never_from', label: 'Never ship them from' }]}
            onChange={(action) => onChange({ action })}
          />
        </s-grid>

        <s-stack gap="small-200">
          <s-text type="strong">Locations</s-text>
          <s-stack direction="inline" gap="base">
            {TYPE_TARGETS.map((t) => (
              <Switch
                key={t.value}
                label={`All ${t.label.toLowerCase()}`}
                checked={rule.location_types.includes(t.value)}
                onChange={(on) => onChange({ location_types: toggleIn(rule.location_types, t.value, on) })}
              />
            ))}
            {locations.map((l) => (
              <Switch
                key={l.id}
                label={l.name}
                checked={rule.location_ids.includes(l.id)}
                onChange={(on) => onChange({ location_ids: toggleIn(rule.location_ids, l.id, on) })}
              />
            ))}
          </s-stack>
          {err('location_types') && <s-text tone="critical">{err('location_types')}</s-text>}
        </s-stack>

        <s-box padding="small-200" background="subdued" borderRadius="base">
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-icon type="info" tone="subdued" />
            <s-text color="subdued">
              {tags.length === 0
                ? 'Add a tag to see what this rule does.'
                : `Products tagged ${tags.map((t) => `“${t}”`).join(' or ')} will ${rule.action === 'only_from' ? 'only' : 'never'} ship from `
                  + (resolved.length ? resolved.map((l) => l.name).join(', ') : 'no locations yet')
                  + '.'}
            </s-text>
          </s-stack>
        </s-box>
      </s-stack>
    </Card>
  );
}
