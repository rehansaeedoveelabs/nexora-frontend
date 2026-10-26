import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { api, toast } from '../lib/api.js';
import { html } from '../lib/html.js';
import { plural } from '../lib/format.js';
import { ErrorState, LoadingState } from '../components/states.js';

const POLL_MS = 3000;
const MAX_POLLS = 40;

export function Home() {
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
    return html`<s-page heading="Home"><${LoadingState} label="Loading your store…" /></s-page>`;
  }

  if (state.status === 'error') {
    return html`<s-page heading="Home"><${ErrorState} error=${state.error} onRetry=${() => setReloadKey((k) => k + 1)} /></s-page>`;
  }

  const { shop, setup } = state.session;

  return html`
    <s-page heading=${shop.name ? `Welcome, ${shop.name}` : 'Home'}>
      ${shop.syncing && html`
        <s-banner tone="info" heading="Importing your locations from Shopify">
          <s-paragraph>This usually takes a few seconds. This page updates automatically.</s-paragraph>
        </s-banner>
      `}

      ${setup.is_complete
        ? html`
          <s-banner tone="success" heading="Your locations are ready">
            <s-paragraph>Every active location has a type. Routing rules arrive in the next release and will use these types.</s-paragraph>
          </s-banner>`
        : html`<${SetupGuide} setup=${setup} />`}

      <${LocationSummary} counts=${state.counts} />
      <${HowItWorks} />
    </s-page>
  `;
}

const STEP_BADGE = {
  complete: ['success', 'Done'],
  incomplete: ['warning', 'To do'],
  upcoming: ['neutral', 'Coming soon'],
};

function SetupGuide({ setup }) {
  const percent = setup.total ? Math.round((setup.completed / setup.total) * 100) : 0;

  return html`
    <s-section heading="Get Nexora ready">
      <s-stack direction="block" gap="base">
        <s-paragraph>
          ${setup.completed} of ${setup.total} steps done. Progress is checked against your real data,
          so a step is only marked done when it actually is.
        </s-paragraph>
        <div
          className="nx-progress"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow=${percent}
          aria-label="Setup progress"
        >
          <div className="nx-progress__bar" style=${{ width: `${percent}%` }} />
        </div>
        <div className="nx-steps">
          ${setup.steps.map((step, index) => html`<${SetupStep} key=${step.key} step=${step} index=${index} />`)}
        </div>
      </s-stack>
    </s-section>
  `;
}

function SetupStep({ step, index }) {
  const navigate = useNavigate();
  const [tone, label] = STEP_BADGE[step.status] ?? STEP_BADGE.incomplete;
  const showAction = step.action && step.status !== 'upcoming';

  return html`
    <div className=${`nx-step nx-step--${step.status}`}>
      <div className="nx-step__number" aria-hidden="true">${step.status === 'complete' ? '✓' : index + 1}</div>
      <s-stack direction="block" gap="small-200">
        <s-stack direction="inline" gap="small" alignItems="center">
          <s-heading>${step.title}</s-heading>
          <s-badge tone=${tone}>${label}</s-badge>
        </s-stack>
        <s-paragraph color="subdued">${step.description}</s-paragraph>
        <s-text type="strong">${step.detail}</s-text>
        ${showAction && html`
          <div>
            <s-button
              variant=${step.status === 'complete' ? 'tertiary' : 'primary'}
              onClick=${() => navigate(step.action.url)}
            >${step.action.label}</s-button>
          </div>
        `}
      </s-stack>
    </div>
  `;
}

const TILES = [
  ['active', 'Active locations', 'Locations currently fulfilling or stocking orders in Shopify.'],
  ['untyped', 'Need a type', 'Active locations Nexora can’t route to yet because their type isn’t set.'],
  ['store', 'Stores', 'Retail locations. Usually ship online orders and offer local pickup.'],
  ['warehouse', 'Warehouses', 'Stock-holding locations that ship online orders.'],
  ['third_party', 'Third-party', 'Locations run by a fulfillment app or 3PL partner.'],
];

function LocationSummary({ counts }) {
  const navigate = useNavigate();

  return html`
    <s-section heading="Your locations at a glance">
      <div className="nx-tiles">
        ${TILES.map(([key, label, definition]) => html`
          <button
            key=${key}
            type="button"
            className=${`nx-tile${key === 'untyped' && counts[key] > 0 ? ' nx-tile--warning' : ''}`}
            onClick=${() => navigate(`/locations?tab=${key}`)}
            aria-label=${`${label}: ${counts[key]}. ${definition} View locations.`}
          >
            <span className="nx-tile__label">${label}</span>
            <span className="nx-tile__value">${counts[key]}</span>
            <span className="nx-tile__definition">${definition}</span>
          </button>
        `)}
      </div>
      <s-paragraph color="subdued">
        ${plural(counts.all, 'location')} in total, including ${counts.inactive} inactive.
      </s-paragraph>
    </s-section>
  `;
}

const HOW = [
  ['1. Describe your locations', 'Tell Nexora which locations are stores, warehouses or third-party partners, and how many orders each can handle per day.', true],
  ['2. Set your routing rules', 'Rank locations and add plain-language rules, like “ship fragile items only from warehouses” or “keep 2 units in every store”.', false],
  ['3. Test, then go live', 'Run sample orders through the simulator and see exactly which location wins and why, before a real customer is affected.', false],
];

function HowItWorks() {
  return html`
    <s-section heading="How Nexora works">
      <div className="nx-how">
        ${HOW.map(([title, text, available]) => html`
          <s-stack key=${title} direction="block" gap="small-200">
            <s-stack direction="inline" gap="small" alignItems="center">
              <s-heading>${title}</s-heading>
              <s-badge tone=${available ? 'success' : 'neutral'}>${available ? 'Available now' : 'Next release'}</s-badge>
            </s-stack>
            <s-paragraph color="subdued">${text}</s-paragraph>
          </s-stack>
        `)}
      </div>
    </s-section>
  `;
}
