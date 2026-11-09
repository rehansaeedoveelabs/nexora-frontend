import { Fragment, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../lib/api.js';
import { plural } from '../lib/format.js';
import { Card, LoadingState } from './states.jsx';

const POLL_MS = 3000;
const MAX_POLLS = 40;

const STEP_ICON = {
  sync_locations: 'location',
  classify_locations: 'store',
  safety_stock: 'inventory',
  routing_rules: 'transfer',
};

const STEP_BADGE = {
  complete: ['success', 'Done', 'check-circle'],
  incomplete: ['warning', 'To do', 'incomplete'],
  upcoming: ['neutral', 'Coming soon', 'clock'],
};

export default function SetupPanel() {
  const [state, setState] = useState({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer = null;
    let polls = 0;

    async function load() {
      try {
        const session = (await api.get('/session')).data;
        const locations = await api.get('/locations');
        if (cancelled) return;

        setState({ status: 'ready', session, counts: locations.meta.counts });
        if (session.shop.syncing && polls++ < MAX_POLLS) timer = setTimeout(load, POLL_MS);
      } catch (error) {
        if (!cancelled) setState({ status: 'error', error });
      }
    }

    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [reloadKey]);

  useEffect(() => {
    if (state.status === 'ready' && window.location.hash === '#store-setup') {
      document.getElementById('store-setup')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [state.status]);

  return (
    <s-section heading="Store setup" id="store-setup">
      {state.status === 'loading' && <LoadingState label="Checking your store setup…" />}
      {state.status === 'error' && (
        <s-banner tone="critical" heading="Couldn’t load your setup progress">
          <s-paragraph>{state.error?.message ?? 'Something went wrong.'}</s-paragraph>
          <s-button slot="secondary-actions" onClick={() => setReloadKey((key) => key + 1)}>Try again</s-button>
        </s-banner>
      )}
      {state.status === 'ready' && (
        <SetupSummary
          shop={state.session.shop}
          setup={state.session.setup}
          counts={state.counts}
        />
      )}
    </s-section>
  );
}

function SetupSummary({ shop, setup, counts }) {
  const navigate = useNavigate();
  const progress = setup.total ? Math.round((setup.completed / setup.total) * 100) : 0;

  return (
    <s-stack gap="base">
      {shop.syncing && (
        <s-banner tone="info" heading="Syncing locations from Shopify">
          <s-paragraph>This checklist updates automatically while your locations are imported.</s-paragraph>
        </s-banner>
      )}

      {setup.is_complete ? (
        <s-banner tone="success" heading="Your store is ready">
          <s-paragraph>{plural(counts.all, 'location')} synced. Your active locations are typed and routing is configured.</s-paragraph>
        </s-banner>
      ) : (
        <>
          <s-stack gap="small-200">
            <s-stack direction="inline" gap="small" alignItems="center" justifyContent="space-between">
              <s-text type="strong">{setup.completed} of {setup.total} steps complete</s-text>
              <s-text color="subdued">{progress}%</s-text>
            </s-stack>
            <s-progress value={setup.completed} max={setup.total} tone="success" accessibilityLabel="Store setup progress" />
          </s-stack>

          <Card padding="none">
            {setup.steps.map((step, index) => {
              const [tone, label, badgeIcon] = STEP_BADGE[step.status] ?? STEP_BADGE.incomplete;
              const done = step.status === 'complete';
              const iconTone = done ? 'success' : step.status === 'upcoming' ? 'subdued' : 'info';
              return (
                <Fragment key={step.key}>
                  {index > 0 && <s-divider />}
                  <s-box padding="base" background={step.status === 'upcoming' ? 'subdued' : 'base'}>
                    <s-grid gridTemplateColumns="auto 1fr auto" gap="base" alignItems="center">
                      <s-icon type={done ? 'check-circle' : (STEP_ICON[step.key] ?? 'settings')} tone={iconTone} />
                      <s-stack gap="small-200">
                        <s-stack direction="inline" gap="small" alignItems="center">
                          <s-text type="strong">{step.title}</s-text>
                          <s-badge tone={tone} icon={badgeIcon}>{label}</s-badge>
                        </s-stack>
                        <s-text color="subdued">{step.detail}</s-text>
                      </s-stack>
                      {step.action && step.status !== 'upcoming' && (
                        <s-button
                          variant={done ? 'tertiary' : 'primary'}
                          onClick={() => navigate(step.action.url)}
                        >
                          {step.action.label}
                        </s-button>
                      )}
                    </s-grid>
                  </s-box>
                </Fragment>
              );
            })}
          </Card>
          <s-text color="subdued">
            {plural(counts.all, 'location')} synced · {plural(counts.untyped, 'location')} still need a type
          </s-text>
        </>
      )}
    </s-stack>
  );
}
