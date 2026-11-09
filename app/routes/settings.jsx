import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { capacityService } from '../services/capacity.js';
import { api } from '../lib/api.js';
import { dateTime, number } from '../lib/format.js';
import { Select } from '../components/fields.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/states.jsx';
import { KpiCard } from '../components/ui.jsx';

const NAV_GROUPS = [
  {
    label: 'STORE',
    items: [{ path: '/settings', key: 'general', title: 'General', icon: 'store' }],
  },
  {
    label: 'OPERATIONS',
    items: [
      { path: '/settings/fulfillment', key: 'fulfillment', title: 'Fulfillment', icon: 'delivery' },
      { path: '/settings/capacity', key: 'capacity', title: 'Capacity', icon: 'inventory' },
      { path: '/settings/routing', key: 'routing', title: 'Routing', icon: 'location' },
    ],
  },
  {
    label: 'PREFERENCES',
    items: [
      { path: '/settings/notifications', key: 'notifications', title: 'Notifications', icon: 'notification' },
      { path: '/settings/advanced', key: 'advanced', title: 'Advanced', icon: 'settings' },
    ],
  },
];

const SECTIONS = NAV_GROUPS.flatMap((group) => group.items);
const TITLES = Object.fromEntries(SECTIONS.map(({ key, title }) => [key, title]));
const NAV_OPTIONS = SECTIONS.map(({ path, title }) => ({ value: path, label: title }));
const COMPACT_NAV_QUERY = '(max-width: 720px)';
const SECTION_DESCRIPTIONS = {
  general: 'Store identity and the places to manage Nexora’s live configuration.',
  fulfillment: 'How Shopify locations participate in fulfillment and where to manage them.',
  capacity: 'Live order usage and saved per-location capacity limits.',
  routing: 'A read-only summary of saved routing preferences and checkout sync.',
  notifications: 'Availability of merchant-facing notification delivery.',
  advanced: 'Operational diagnostics currently exposed by Nexora.',
};

function sectionForPath(path) {
  return SECTIONS.find((section) => section.path === path)?.key
    ?? (path === '/settings/billing' ? 'advanced' : 'general');
}

function useCompactNavigation() {
  const [compact, setCompact] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(COMPACT_NAV_QUERY).matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(COMPACT_NAV_QUERY);
    const update = () => setCompact(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  return compact;
}

function useResource(section, reloadKey) {
  const [state, setState] = useState({ status: 'idle' });
  const needsShop = section === 'general';
  const needsCapacity = section === 'capacity';
  const needsRouting = ['routing', 'advanced'].includes(section);

  useEffect(() => {
    if (!needsShop && !needsCapacity && !needsRouting) {
      setState({ status: 'idle' });
      return undefined;
    }

    let cancelled = false;
    setState({ status: 'loading' });
    const request = needsShop
      ? api.get('/session').then((response) => response.data)
      : needsCapacity
        ? capacityService.overview()
        : api.get('/routing').then((response) => response.data);

    request
      .then((data) => !cancelled && setState({ status: 'ready', data }))
      .catch((error) => !cancelled && setState({ status: 'error', error }));

    return () => { cancelled = true; };
  }, [needsShop, needsCapacity, needsRouting, reloadKey]);

  return state;
}

function FieldValue({ label, value }) {
  const displayValue = value === null || value === undefined || value === ''
    ? 'Not available'
    : value;

  return (
    <s-stack gap="small-100">
      <s-text color="subdued">{label}</s-text>
      <s-text type="strong">{displayValue}</s-text>
    </s-stack>
  );
}

function StoreInformation({ shop }) {
  const plan = shop.plan
    ? shop.plan.charAt(0).toUpperCase() + shop.plan.slice(1)
    : null;
  const fields = [
    ['Store name', shop.name],
    ['Store domain', shop.domain],
    ['Currency', shop.currency],
    ['Timezone', shop.timezone],
    ['Shopify plan', plan],
  ];

  return (
    <s-stack gap="base">
      <s-stack direction="inline" gap="small" alignItems="center">
        <s-heading>Store information</s-heading>
        <s-badge tone="info">Managed by Shopify</s-badge>
      </s-stack>
      <s-paragraph color="subdued">
        Store identity is read from the authenticated Shopify installation and can’t be edited in Nexora.
      </s-paragraph>
      <s-grid gridTemplateColumns="repeat(auto-fit, minmax(180px, 1fr))" gap="large">
        {fields.map(([label, value]) => <FieldValue key={label} label={label} value={value} />)}
      </s-grid>
    </s-stack>
  );
}

function GeneralSection({ state, onRetry, navigate }) {
  if (state.status === 'loading' || state.status === 'idle') {
    return <LoadingState label="Loading Shopify store information…" />;
  }
  if (state.status === 'error') return <ErrorState error={state.error} onRetry={onRetry} />;

  return (
    <s-stack gap="large">
      <StoreInformation shop={state.data.shop} />
      <s-divider />
      <s-stack gap="base">
        <s-heading>Nexora configuration</s-heading>
        <s-paragraph color="subdued">
          There are no separate general preferences to save. Manage live fulfillment and routing behavior in the operational sections below.
        </s-paragraph>
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
          <s-box border="base" borderRadius="large" padding="base">
            <s-stack gap="base">
              <s-stack gap="small-100">
                <s-text type="strong">Fulfillment locations</s-text>
                <s-text color="subdued">Review Shopify location capabilities and Nexora limits.</s-text>
              </s-stack>
              <s-button variant="secondary" onClick={() => navigate('/settings/fulfillment')}>Manage fulfillment</s-button>
            </s-stack>
          </s-box>
          <s-box border="base" borderRadius="large" padding="base">
            <s-stack gap="base">
              <s-stack gap="small-100">
                <s-text type="strong">Routing rules</s-text>
                <s-text color="subdued">Review location priorities and checkout rule status.</s-text>
              </s-stack>
              <s-button variant="secondary" onClick={() => navigate('/settings/routing')}>Review routing</s-button>
            </s-stack>
          </s-box>
        </s-grid>
      </s-stack>
    </s-stack>
  );
}

function FulfillmentSection({ navigate }) {
  return (
    <s-stack gap="large">
      <s-stack gap="base">
        <s-heading>Fulfillment configuration</s-heading>
        <s-paragraph>
          Shopify locations determine where orders can ship or be picked up. Nexora reads those capabilities and uses them when evaluating eligible fulfillment locations.
        </s-paragraph>
      </s-stack>
      <s-divider />
      <s-stack gap="base">
        <s-heading>Manage locations in one place</s-heading>
        <s-paragraph color="subdued">
          Location types, Nexora capacity limits, and supported tags are managed on the Locations page. Shipping and pickup capabilities remain controlled by Shopify.
        </s-paragraph>
        <s-button variant="primary" onClick={() => navigate('/locations')}>Open locations</s-button>
      </s-stack>
      <s-divider />
      <s-stack gap="base">
        <s-heading>Routing behavior</s-heading>
        <s-paragraph color="subdued">
          Location priority, product-tag restrictions, and keep-orders-together behavior are configured separately from location details.
        </s-paragraph>
        <s-button onClick={() => navigate('/routing')}>Open routing rules</s-button>
      </s-stack>
    </s-stack>
  );
}

function CapacitySection({ state, onRetry, navigate }) {
  if (state.status === 'loading' || state.status === 'idle') {
    return <LoadingState label="Loading live location capacity…" />;
  }
  if (state.status === 'error') return <ErrorState error={state.error} onRetry={onRetry} />;

  const { rows, asOf, timezone, totals } = state.data;
  const configuredRows = rows.filter((row) => row.dailyCap != null);
  const configuredLimit = configuredRows.reduce((sum, row) => sum + row.dailyCap, 0);
  const configuredUsage = configuredRows.reduce((sum, row) => sum + row.ordersToday, 0);

  return (
    <s-stack gap="large">
      <s-stack gap="base">
        <s-heading>Capacity overview</s-heading>
        <s-paragraph color="subdued">
          Usage counts non-cancelled Shopify orders created today in the store’s timezone. Daily limits are used by Nexora’s automatic routing when configured.
        </s-paragraph>
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(170px, 1fr))" gap="base">
          <KpiCard label="Orders today" value={number(totals.ordersToday)} help="Non-cancelled orders · store timezone" />
          <KpiCard label="Locations with daily limits" value={number(configuredRows.length)} help="Limits configured in Nexora" />
          <KpiCard label="Configured daily capacity" value={number(configuredLimit)} help={`${number(configuredUsage)} orders today at locations with limits`} />
        </s-grid>
      </s-stack>

      <s-divider />

      <s-stack gap="base">
        <s-stack direction="inline" gap="small" alignItems="center" justifyContent="space-between">
          <s-heading>Location limits</s-heading>
          <s-text color="subdued">
            Updated {new Date(asOf).toLocaleTimeString([], { timeZone: timezone })} · {timezone}
          </s-text>
        </s-stack>
        {rows.length === 0 ? (
          <EmptyState
            heading="No locations available"
            text="Sync Shopify locations to review capacity."
            action={{ label: 'Open locations', onClick: () => navigate('/locations') }}
          />
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Location</s-table-header>
              <s-table-header>Orders today</s-table-header>
              <s-table-header>Daily limit</s-table-header>
              <s-table-header>Backlog limit</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {rows.map((row) => (
                <s-table-row key={row.id}>
                  <s-table-cell>
                    <s-clickable onClick={() => navigate(`/locations/${row.id}`)}>
                      <s-text type="strong">{row.name}</s-text>
                    </s-clickable>
                  </s-table-cell>
                  <s-table-cell>
                    {row.dailyCap == null
                      ? number(row.ordersToday)
                      : (
                        <s-stack gap="small-200">
                          <s-text>{number(row.ordersToday)} of {number(row.dailyCap)}</s-text>
                          <s-progress
                            value={Math.min(row.ordersToday, row.dailyCap)}
                            max={Math.max(1, row.dailyCap)}
                            accessibilityLabel={`${row.name} daily capacity usage`}
                          />
                        </s-stack>
                      )}
                  </s-table-cell>
                  <s-table-cell>{row.dailyCap == null ? 'No limit' : number(row.dailyCap)}</s-table-cell>
                  <s-table-cell>
                    {row.backlogCap === null ? 'Not set' : `${number(row.backlogCap)} · not enforced`}
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
        <s-button onClick={() => navigate('/locations')}>Manage location limits</s-button>
      </s-stack>

      <s-banner tone="warning" heading="Backlog limits are not enforced">
        <s-paragraph>
          Nexora stores configured backlog limits but does not calculate or enforce current backlog. Daily order limits are the supported capacity control.
        </s-paragraph>
      </s-banner>
    </s-stack>
  );
}

function checkoutSyncState(status) {
  return {
    synced: ['success', 'Synced to Shopify'],
    pending: ['warning', 'Sync in progress'],
    failed: ['critical', 'Sync failed'],
    not_synced: ['warning', 'Not synced'],
    not_configured: ['info', 'Not configured'],
  }[status] ?? ['info', status];
}

function RoutingSection({ state, onRetry, navigate }) {
  if (state.status === 'loading' || state.status === 'idle') {
    return <LoadingState label="Loading saved routing configuration…" />;
  }
  if (state.status === 'error') return <ErrorState error={state.error} onRetry={onRetry} />;

  const { settings, locations, updated_at: updatedAt, checkout_sync: checkoutSync } = state.data ?? {};
  if (
    !settings
    || !Array.isArray(locations)
    || (settings.priority != null && !Array.isArray(settings.priority))
    || (settings.rules != null && !Array.isArray(settings.rules))
    || !checkoutSync
  ) {
    return (
      <s-stack gap="base">
        <s-banner tone="critical" heading="Routing configuration is incomplete">
          <s-paragraph>
            Nexora couldn’t read the saved routing configuration. Reload this section or open Routing to review and save the configuration again.
          </s-paragraph>
        </s-banner>
        <s-stack direction="inline" gap="base">
          <s-button onClick={onRetry}>Reload settings</s-button>
          <s-button variant="primary" onClick={() => navigate('/routing')}>Open routing</s-button>
        </s-stack>
      </s-stack>
    );
  }

  const priorityIds = settings.priority ?? [];
  const remainingLocations = locations.filter((item) => !priorityIds.some((id) => String(id) === String(item.id)));
  const priorities = [...priorityIds, ...remainingLocations.map((item) => item.id)]
    .map((id) => locations.find((item) => String(item.id) === String(id))?.name)
    .filter(Boolean);
  const enabledRules = (settings.rules ?? []).filter((rule) => rule.enabled);
  const [syncTone, syncLabel] = checkoutSyncState(checkoutSync.status);
  const localPreference = settings.prefer_local === 'country'
    ? 'Customer country'
    : settings.prefer_local === 'province'
      ? 'Customer state or province'
      : 'No preference';

  return (
    <s-stack gap="large">
      <s-stack gap="base">
        <s-stack direction="inline" gap="small" alignItems="center">
          <s-heading>Routing overview</s-heading>
          <s-badge tone={syncTone}>{syncLabel}</s-badge>
        </s-stack>
        <s-paragraph color="subdued">
          Review the configuration currently used by Nexora. Change rules and priorities in Routing, not here.
        </s-paragraph>
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(180px, 1fr))" gap="large">
          <FieldValue label="Configuration" value={updatedAt ? `Saved ${dateTime(updatedAt)}` : 'Nexora defaults · not saved'} />
          <FieldValue label="Keep orders together" value={settings.no_split ? 'On' : 'Off'} />
          <FieldValue label="Nearby preference" value={localPreference} />
          <FieldValue label="Active product-tag rules" value={number(enabledRules.length)} />
        </s-grid>
      </s-stack>

      {priorities.length > 0 && (
        <>
          <s-divider />
          <s-stack gap="base">
            <s-heading>Location priority</s-heading>
            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(180px, 1fr))" gap="small">
              {priorities.map((name, index) => (
                <s-box key={`${index}-${name}`} padding="small" background="subdued" borderRadius="base">
                  <s-stack direction="inline" gap="small" alignItems="center">
                    <s-badge tone="info">{index + 1}</s-badge>
                    <s-text type="strong">{name}</s-text>
                  </s-stack>
                </s-box>
              ))}
            </s-grid>
          </s-stack>
        </>
      )}

      {(checkoutSync.error || checkoutSync.synced_at) && <s-divider />}
      {checkoutSync.error && (
        <s-banner tone="critical" heading="Checkout sync needs attention">
          <s-paragraph>{checkoutSync.error}</s-paragraph>
        </s-banner>
      )}
      {checkoutSync.synced_at && (
        <s-text color="subdued">Last successful checkout sync: {dateTime(checkoutSync.synced_at)}</s-text>
      )}
      <s-button variant="primary" onClick={() => navigate('/routing')}>Manage routing rules</s-button>
    </s-stack>
  );
}

function NotificationsSection({ navigate }) {
  return (
    <s-stack gap="base">
      <s-heading>Notification delivery</s-heading>
      <s-banner tone="warning" heading="Notification delivery isn’t connected">
        <s-paragraph>
          Nexora does not currently have a merchant notification provider. Preferences are not configurable until delivery is implemented.
        </s-paragraph>
      </s-banner>
      <s-paragraph color="subdued">
        Routing outcomes are recorded in the activity log. Activity records are not sent as alerts.
      </s-paragraph>
      <s-button onClick={() => navigate('/activity')}>View activity log</s-button>
    </s-stack>
  );
}

function AdvancedSection({ state, onRetry, legacyBilling }) {
  if (legacyBilling) {
    return (
      <s-stack gap="base">
        <s-heading>Plan & usage</s-heading>
        <s-banner tone="warning" heading="Shopify Billing isn’t connected">
          <s-paragraph>
            Subscription status, plan pricing, and usage allowances are unavailable. Nexora does not display estimated prices or initiate charges here.
          </s-paragraph>
        </s-banner>
      </s-stack>
    );
  }

  if (state.status === 'loading' || state.status === 'idle') {
    return <LoadingState label="Loading operational diagnostics…" />;
  }
  if (state.status === 'error') return <ErrorState error={state.error} onRetry={onRetry} />;

  const checkoutSync = state.data.checkout_sync;
  const [syncTone, syncLabel] = checkoutSyncState(checkoutSync.status);

  return (
    <s-stack gap="large">
      <s-stack gap="base">
        <s-heading>Checkout rule sync</s-heading>
        <s-stack direction="inline" gap="small" alignItems="center">
          <s-badge tone={syncTone}>{syncLabel}</s-badge>
          {checkoutSync.synced_at && <s-text color="subdued">Last successful sync: {dateTime(checkoutSync.synced_at)}</s-text>}
        </s-stack>
        {checkoutSync.error && (
          <s-banner tone="critical" heading="Checkout sync error">
            <s-paragraph>{checkoutSync.error}</s-paragraph>
          </s-banner>
        )}
      </s-stack>
      <s-divider />
      <s-stack gap="base">
        <s-heading>Managed by Nexora</s-heading>
        <s-paragraph color="subdued">
          Retry policies and internal processing safeguards are managed by Nexora. They are not merchant-configurable, and credentials are never displayed here.
        </s-paragraph>
      </s-stack>
    </s-stack>
  );
}

export default function Settings() {
  const location = useLocation();
  const navigate = useNavigate();
  const section = sectionForPath(location.pathname);
  const compactNavigation = useCompactNavigation();
  const [reloadKey, setReloadKey] = useState(0);
  const resource = useResource(section, reloadKey);
  const retry = () => setReloadKey((current) => current + 1);
  const legacyBilling = location.pathname === '/settings/billing';
  const title = legacyBilling ? 'Plan & usage' : TITLES[section] ?? 'Settings';

  return (
    <s-page heading="Settings" inlineSize="large">
      <s-button slot="secondary-actions" onClick={() => navigate('/')}>Back to overview</s-button>
      <s-stack gap="large">
        <s-paragraph color="subdued">
          Configure your Nexora preferences and store information.
        </s-paragraph>

        {compactNavigation && (
          <Select
            label="Settings section"
            value={SECTIONS.find((item) => item.key === section)?.path ?? '/settings/advanced'}
            options={NAV_OPTIONS}
            onChange={navigate}
          />
        )}

        <s-grid
          gridTemplateColumns={compactNavigation ? 'minmax(0, 1fr)' : 'minmax(200px, 240px) minmax(0, 1fr)'}
          gap="base"
          alignItems="start"
        >
          {!compactNavigation && (
            <s-section>
              <s-stack gap="base" alignItems="start">
                {NAV_GROUPS.map((group) => (
                  <s-stack key={group.label} gap="small-100" alignItems="start">
                    <s-text type="strong" color="subdued">{group.label}</s-text>
                    {group.items.map((item) => (
                      <s-button
                        key={item.key}
                        variant={section === item.key ? 'secondary' : 'tertiary'}
                        icon={item.icon}
                        onClick={() => navigate(item.path)}
                      >
                        {item.title}
                      </s-button>
                    ))}
                  </s-stack>
                ))}
              </s-stack>
            </s-section>
          )}

          <s-section heading={title}>
            <s-stack gap="large">
              <s-paragraph color="subdued">
                {legacyBilling
                  ? 'Billing information is not available in this version of Nexora.'
                  : SECTION_DESCRIPTIONS[section]}
              </s-paragraph>
              <s-divider />
              {section === 'general' && <GeneralSection state={resource} onRetry={retry} navigate={navigate} />}
              {section === 'fulfillment' && <FulfillmentSection navigate={navigate} />}
              {section === 'capacity' && <CapacitySection state={resource} onRetry={retry} navigate={navigate} />}
              {section === 'routing' && <RoutingSection state={resource} onRetry={retry} navigate={navigate} />}
              {section === 'notifications' && <NotificationsSection navigate={navigate} />}
              {section === 'advanced' && <AdvancedSection state={resource} onRetry={retry} legacyBilling={legacyBilling} />}
            </s-stack>
          </s-section>
        </s-grid>
      </s-stack>
    </s-page>
  );
}
