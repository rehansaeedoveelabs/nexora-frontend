import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ApiError, api, toast } from '../lib/api.js';
import { splitTags } from '../lib/format.js';
import { Select, Switch, TextField } from '../components/fields.jsx';
import { Card, ErrorState, LoadingState } from '../components/states.jsx';
import { Simulator } from '../components/Simulator.jsx';

/**
 * Full-page editor for a SINGLE real product rule. It loads the live routing settings, edits one
 * rule, and saves by PUT-ing the whole settings back through /api/routing — so it writes the exact
 * same rules the /routing page and checkout use (no parallel rule system). Includes Test Rule, which
 * reuses the real order simulator with the rule applied in context.
 */

const newId = () => (globalThis.crypto?.randomUUID?.() ?? `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

const TYPE_TARGETS = [
  { value: 'warehouse', label: 'Warehouses' },
  { value: 'store', label: 'Stores' },
  { value: 'third_party', label: 'Third-party' },
];

const SAVE_BAR_ID = 'nexora-rule-editor-save-bar';
const blankRule = () => ({ id: newId(), enabled: true, tagsText: '', action: 'only_from', location_types: ['warehouse'], location_ids: [] });

// Server rule (tags: array) → editor draft (tagsText: string).
const toDraft = (rule) => ({
  id: rule.id,
  enabled: rule.enabled,
  tagsText: (rule.tags ?? []).join(', '),
  action: rule.action,
  location_types: [...(rule.location_types ?? [])],
  location_ids: [...(rule.location_ids ?? [])],
});

const draftToPayload = (d) => ({
  id: d.id, enabled: d.enabled, tags: splitTags(d.tagsText), action: d.action,
  location_types: d.location_types, location_ids: d.location_ids,
});

const serverToPayload = (r) => ({
  id: r.id, enabled: r.enabled, tags: r.tags ?? [], action: r.action,
  location_types: r.location_types ?? [], location_ids: r.location_ids ?? [],
});

const saveBar = {
  show: () => window.shopify?.saveBar?.show?.(SAVE_BAR_ID),
  hide: () => window.shopify?.saveBar?.hide?.(SAVE_BAR_ID),
};

export default function RuleEditor() {
  const { ruleId } = useParams();
  const navigate = useNavigate();
  const isNew = !ruleId;

  const [state, setState] = useState({ status: 'loading' });
  const [draft, setDraft] = useState(null);
  const [savedRule, setSavedRule] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.get('/routing')
      .then(({ data }) => {
        if (cancelled) return;
        const existing = isNew ? null : data.settings.rules.find((r) => r.id === ruleId);
        if (!isNew && !existing) { setState({ status: 'missing' }); return; }
        const initialDraft = isNew ? blankRule() : toDraft(existing);
        setState({ status: 'ready', ...data });
        setDraft(initialDraft);
        setSavedRule(draftToPayload(initialDraft));
      })
      .catch((error) => !cancelled && setState({ status: 'error', error }));
    return () => { cancelled = true; };
  }, [ruleId, isNew, reloadKey]);

  const dirty = useMemo(
    () => draft && savedRule && JSON.stringify(draftToPayload(draft)) !== JSON.stringify(savedRule),
    [draft, savedRule],
  );
  const update = useCallback((patch) => {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors({});
  }, []);

  const discard = useCallback(() => {
    if (!savedRule) return;
    setDraft({ ...savedRule, tagsText: savedRule.tags.join(', ') });
    setErrors({});
  }, [savedRule]);

  const go = useCallback(async (url) => {
    if (window.shopify?.saveBar?.leaveConfirmation) await window.shopify.saveBar.leaveConfirmation();
    navigate(url);
  }, [navigate]);

  useEffect(() => {
    if (dirty) saveBar.show(); else saveBar.hide();
  }, [dirty]);
  useEffect(() => () => saveBar.hide(), []);

  // The full settings payload with this rule merged in — used both to save and to drive Test Rule.
  const payload = useMemo(() => {
    if (state.status !== 'ready' || !draft) return null;
    const rules = isNew
      ? [...state.settings.rules.map(serverToPayload), draftToPayload(draft)]
      : state.settings.rules.map((r) => (r.id === draft.id ? draftToPayload(draft) : serverToPayload(r)));
    return {
      priority: state.settings.priority,
      prefer_local: state.settings.prefer_local ?? null,
      no_split: state.settings.no_split,
      rules,
    };
  }, [state, draft, isNew]);

  async function save() {
    if (!payload || !dirty || saving) return;
    // Client-side checks mirror the backend so obvious mistakes don't need a round trip.
    const tags = splitTags(draft.tagsText);
    const localErrors = {};
    if (tags.length === 0) localErrors.tags = 'Add at least one product tag.';
    if (draft.location_types.length === 0 && draft.location_ids.length === 0) {
      localErrors.location_types = 'Choose at least one location.';
    }
    if (Object.keys(localErrors).length) {
      setErrors(localErrors);
      toast('Fix the highlighted fields, then save again.', true);
      return;
    }

    setSaving(true);
    setErrors({});
    try {
      await api.put('/routing', payload);
      saveBar.hide();
      toast(isNew ? 'Rule created' : 'Rule saved');
      navigate('/routing');
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        const index = payload.rules.findIndex((r) => r.id === draft.id);
        const fields = error.fieldErrors ?? {};
        setErrors({
          tags: fields[`rules.${index}.tags`] ?? fields[`rules.${index}.tags.0`],
          location_types: fields[`rules.${index}.location_types`],
        });
        toast('Fix the highlighted fields, then save again.', true);
      } else {
        toast(error.message, true);
      }
    } finally {
      setSaving(false);
    }
  }

  const heading = isNew ? 'Create routing rule' : 'Edit routing rule';

  if (state.status === 'loading') return <s-page heading={heading} inlineSize="large"><LoadingState label="Loading routing…" /></s-page>;
  if (state.status === 'error') return <s-page heading={heading} inlineSize="large"><ErrorState error={state.error} onRetry={() => setReloadKey((k) => k + 1)} /></s-page>;
  if (state.status === 'missing') {
    return (
      <s-page heading="Rule not found" inlineSize="large">
        <s-section>
          <s-stack gap="base" alignItems="start">
            <s-paragraph>This rule no longer exists. It may have been deleted.</s-paragraph>
            <s-button variant="primary" onClick={() => navigate('/routing')}>Back to routing</s-button>
          </s-stack>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading={heading} inlineSize="large">
      <s-button slot="secondary-actions" onClick={() => go('/routing')}>Back to routing</s-button>
      <s-button slot="primary-action" variant="primary" disabled={!dirty || saving} loading={saving} onClick={save}>{isNew ? 'Create rule' : 'Save rule'}</s-button>

      <ui-save-bar id={SAVE_BAR_ID}>
        <button variant="primary" onClick={save} {...(saving ? { loading: '' } : {})}>{isNew ? 'Create rule' : 'Save rule'}</button>
        <button onClick={discard} {...(saving ? { disabled: '' } : {})}>Discard</button>
      </ui-save-bar>

      <s-stack gap="base">
        <s-box border="base" borderRadius="large" padding="base" background="subdued">
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-text type="strong">{dirty ? 'Unsaved changes' : isNew ? 'New rule draft' : 'All changes saved'}</s-text>
            <s-badge tone={draft.enabled ? 'success' : 'neutral'}>{draft.enabled ? 'Rule on' : 'Rule off'}</s-badge>
          </s-stack>
        </s-box>
        <s-paragraph color="subdued">
          Control where products with specific tags ship from. Rules apply on every Shopify plan and
          start affecting real checkouts when Nexora’s checkout integration is switched on.
        </s-paragraph>

        <RuleForm draft={draft} locations={state.locations} errors={errors} onChange={update} />

        <Simulator locations={state.locations} draftPayload={payload} isPlus={state.plan.is_plus} />
      </s-stack>
    </s-page>
  );
}

function RuleForm({ draft, locations, errors, onChange }) {
  const toggleIn = (list, value, on) => (on ? [...new Set([...list, value])] : list.filter((v) => v !== value));
  const tags = splitTags(draft.tagsText);
  const resolved = locations.filter((l) => draft.location_types.includes(l.type) || draft.location_ids.includes(l.id));

  return (
    <s-section heading="Rule">
      <s-stack gap="base">
        <Switch
          label={draft.enabled ? 'Rule is on' : 'Rule is off'}
          details="Turn off to keep the rule without applying it."
          checked={draft.enabled}
          onChange={(enabled) => onChange({ enabled })}
        />

        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(240px, 1fr))" gap="base" alignItems="start">
          <TextField
            label="When an order contains products tagged"
            placeholder="e.g. fragile, glass"
            value={draft.tagsText}
            error={errors.tags}
            details="Separate tags with commas. A product needs any one of them."
            onInput={(tagsText) => onChange({ tagsText })}
          />
          <Select
            label="Then"
            value={draft.action}
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
                checked={draft.location_types.includes(t.value)}
                onChange={(on) => onChange({ location_types: toggleIn(draft.location_types, t.value, on) })}
              />
            ))}
            {locations.map((l) => (
              <Switch
                key={l.id}
                label={l.name}
                checked={draft.location_ids.includes(l.id)}
                onChange={(on) => onChange({ location_ids: toggleIn(draft.location_ids, l.id, on) })}
              />
            ))}
          </s-stack>
          {errors.location_types && <s-text tone="critical">{errors.location_types}</s-text>}
        </s-stack>

        <Card subdued>
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-icon type="info" tone="subdued" />
            <s-text color="subdued">
              {tags.length === 0
                ? 'Add a tag to see what this rule does.'
                : `Products tagged ${tags.map((t) => `“${t}”`).join(' or ')} will ${draft.action === 'only_from' ? 'only' : 'never'} ship from `
                  + (resolved.length ? resolved.map((l) => l.name).join(', ') : 'no locations yet')
                  + '.'}
            </s-text>
          </s-stack>
        </Card>
      </s-stack>
    </s-section>
  );
}
