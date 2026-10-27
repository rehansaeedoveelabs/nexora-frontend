import { Fragment, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { api, toast } from '../lib/api.js';
import { plural } from '../lib/format.js';
import { Card, ErrorState, LoadingState } from '../components/states.jsx';

const POLL_MS = 3000;
const MAX_POLLS = 40;

export default function Home() {
  const [state, setState] = useState({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer = null;
    let polls = 0;

    async function load() {
      try {
        // Session first: on the very first open this call performs the install (token exchange).
        const session = (await api.get('/session')).data;
        const locations = await api.get('/locations');
        if (cancelled) return;

        setState({ status: 'ready', session, counts: locations.meta.counts });

        // While the first import runs, refresh until it finishes.
        if (session.shop.syncing && polls++ < MAX_POLLS) timer = setTimeout(load, POLL_MS);
      } catch (error) {
        if (cancelled) return;
        setState({ status: 'error', error });
        toast(error.message, true);
      }
    }

    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [reloadKey]);

  if (state.status === 'loading') {
    return <s-page heading="Home"><LoadingState label="Loading your store…" /></s-page>;
  }

  if (state.status === 'error') {
    return <s-page heading="Home"><ErrorState error={state.error} onRetry={() => setReloadKey((k) => k + 1)} /></s-page>;
  }

  const { shop, setup } = state.session;

  return (
    <s-page heading={shop.name ? `Welcome, ${shop.name}` : 'Home'}>
      <s-stack gap="large">
        {shop.syncing && (
          <s-banner tone="info" heading="Importing your locations from Shopify">
            <s-paragraph>This usually takes a few seconds. This page updates automatically.</s-paragraph>
          </s-banner>
        )}

        {setup.is_complete ? (
          <s-banner tone="success" heading="Your store is set up">
            <s-paragraph>Every active location has a type and your routing is saved. You can change it any time.</s-paragraph>
          </s-banner>
        ) : (
          <SetupGuide setup={setup} />
        )}

        <LocationSummary counts={state.counts} />
        <HowItWorks />
      </s-stack>
    </s-page>
  );
}

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

function SetupGuide({ setup }) {
  const percent = setup.total ? Math.round((setup.completed / setup.total) * 100) : 0;

  return (
    <s-section heading="Get Nexora ready">
      <s-stack gap="large">
        <s-stack gap="small-200">
          <s-stack direction="inline" gap="small" alignItems="center" justifyContent="space-between">
            <s-text type="strong">{setup.completed} of {setup.total} steps done</s-text>
            <s-text color="subdued">{percent}%</s-text>
          </s-stack>
          <s-progress value={setup.completed} max={setup.total} tone="success" accessibilityLabel="Setup progress" />
          <s-text color="subdued">Checked against your real data, so a step is only marked done when it actually is.</s-text>
        </s-stack>

        <Card padding="none">
          {setup.steps.map((step, index) => (
            <Fragment key={step.key}>
              {index > 0 && <s-divider />}
              <SetupStep step={step} index={index} />
            </Fragment>
          ))}
        </Card>
      </s-stack>
    </s-section>
  );
}

function SetupStep({ step, index }) {
  const navigate = useNavigate();
  const [tone, label, badgeIcon] = STEP_BADGE[step.status] ?? STEP_BADGE.incomplete;
  const showAction = step.action && step.status !== 'upcoming';
  const done = step.status === 'complete';

  return (
    <s-box padding="base" background={step.status === 'upcoming' ? 'subdued' : 'base'}>
      <s-grid gridTemplateColumns="auto 1fr" gap="base">
        <s-box
          padding="small-100"
          borderRadius="base"
          background={done ? 'strong' : 'subdued'}
        >
          <s-icon type={done ? 'check-circle' : (STEP_ICON[step.key] ?? 'settings')} tone={done ? 'success' : 'base'} />
        </s-box>
        <s-stack gap="small-200">
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-heading>{step.title}</s-heading>
            <s-badge tone={tone} icon={badgeIcon}>{label}</s-badge>
          </s-stack>
          <s-paragraph color="subdued">{step.description}</s-paragraph>
          <s-text type="strong">{step.detail}</s-text>
          {showAction && (
            <s-stack direction="inline">
              <s-button variant={done ? 'tertiary' : 'primary'} onClick={() => navigate(step.action.url)}>
                {step.action.label}
              </s-button>
            </s-stack>
          )}
        </s-stack>
      </s-grid>
    </s-box>
  );
}

const TILES = [
  ['active', 'Active locations', 'location', 'Currently fulfilling or stocking orders in Shopify.'],
  ['untyped', 'Need a type', 'alert-triangle', 'Active locations Nexora can’t route to yet because their type isn’t set.'],
  ['store', 'Stores', 'store', 'Retail locations. Usually ship online orders and offer local pickup.'],
  ['warehouse', 'Warehouses', 'inventory', 'Stock-holding locations that ship online orders.'],
  ['third_party', 'Third-party', 'store-managed', 'Locations run by a fulfillment app or 3PL partner.'],
];

function LocationSummary({ counts }) {
  const navigate = useNavigate();

  return (
    <s-section heading="Your locations at a glance">
      <s-stack gap="base">
        <s-query-container>
          <s-grid gridTemplateColumns="repeat(auto-fit, minmax(180px, 1fr))" gap="base">
            {TILES.map(([key, label, icon, definition]) => {
              const attention = key === 'untyped' && counts[key] > 0;
              return (
                <s-clickable
                  key={key}
                  border="base"
                  borderColor={attention ? 'strong' : 'base'}
                  borderRadius="large"
                  padding="base"
                  background={attention ? 'subdued' : 'base'}
                  accessibilityLabel={`${label}: ${counts[key]}. ${definition} View locations.`}
                  onClick={() => navigate(`/locations?tab=${key}`)}
                >
                  <s-stack gap="small-200">
                    <s-stack direction="inline" gap="small-200" alignItems="center">
                      <s-icon type={icon} tone={attention ? 'warning' : 'subdued'} />
                      <s-text type="strong">{label}</s-text>
                    </s-stack>
                    <s-heading>{counts[key]}</s-heading>
                    <s-text color="subdued">{definition}</s-text>
                  </s-stack>
                </s-clickable>
              );
            })}
          </s-grid>
        </s-query-container>
        <s-text color="subdued">
          {plural(counts.all, 'location')} in total, including {counts.inactive} inactive.
        </s-text>
      </s-stack>
    </s-section>
  );
}

const HOW = [
  ['store', '1. Describe your locations', 'Tell Nexora which locations are stores, warehouses or third-party partners, and how many orders each can handle per day.', 'Available now'],
  ['transfer', '2. Set your routing rules', 'Rank locations and add plain-language rules, like “ship fragile items only from warehouses”. Test them with the order simulator.', 'Available now'],
  ['play', '3. Go live at checkout', 'Switch your rules on for real checkouts once Nexora’s checkout integration is enabled.', 'Next release'],
];

function HowItWorks() {
  return (
    <s-section heading="How Nexora works">
      <s-query-container>
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(240px, 1fr))" gap="large">
          {HOW.map(([icon, title, text, status]) => (
            <s-stack key={title} gap="small-200">
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <s-icon type={icon} tone="base" />
                <s-heading>{title}</s-heading>
              </s-stack>
              <s-badge tone={status === 'Available now' ? 'success' : 'neutral'}>{status}</s-badge>
              <s-paragraph color="subdued">{text}</s-paragraph>
            </s-stack>
          ))}
        </s-grid>
      </s-query-container>
    </s-section>
  );
}
