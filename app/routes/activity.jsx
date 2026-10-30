import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { activityService } from '../services/activity.js';
import { dateTime, number, relative } from '../lib/format.js';
import { EmptyState, ErrorState, LoadingState } from '../components/states.jsx';
import { SearchField, Select } from '../components/fields.jsx';

const TYPES = [
  { value: 'all', label: 'All Nexora changes' },
  { value: 'routing_config_updated', label: 'Routing configuration' },
  { value: 'location_settings_updated', label: 'Location settings' },
  { value: 'location_types_bulk_updated', label: 'Bulk location updates' },
  { value: 'order_fulfillment_reassigned', label: 'Order fulfillment reassigned' },
  { value: 'order_automatically_routed', label: 'Order automatically routed' },
  { value: 'order_automatic_routing_unchanged', label: 'Automatic routing unchanged' },
  { value: 'order_automatic_routing_skipped', label: 'Automatic routing skipped' },
  { value: 'order_automatic_routing_partial', label: 'Automatic routing partially completed' },
];

export default function Activity() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState({ status: 'loading', events: [], pageInfo: null, filterType: 'all' });
  const [reloadKey, setReloadKey] = useState(0);
  const [type, setType] = useState('all');
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [selectedId, setSelectedId] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', events: [], pageInfo: null, filterType: type });
    setSelectedId(null);
    setLoadError('');
    activityService.list(null, type)
      .then(({ events, pageInfo }) => !cancelled && setState({ status: 'ready', events, pageInfo, filterType: type }))
      .catch((error) => !cancelled && setState({ status: 'error', error }));
    return () => { cancelled = true; };
  }, [reloadKey, type]);

  const events = useMemo(() => {
    if (state.status !== 'ready') return [];
    const search = query.trim().toLowerCase();
    return state.events.filter((event) => (
      !search || `${event.typeLabel} ${event.subject} ${event.summary}`.toLowerCase().includes(search)
    ));
  }, [state, query]);
  const selected = events.find((event) => event.id === selectedId) ?? null;

  async function loadMore() {
    if (!state.pageInfo?.end_cursor || loadingMore) return;
    const cursor = state.pageInfo.end_cursor;
    setLoadingMore(true);
    setLoadError('');
    try {
      const { events: nextEvents, pageInfo } = await activityService.list(cursor, type);
      setState((current) => current.status === 'ready'
        && current.filterType === type
        && current.pageInfo?.end_cursor === cursor
        ? { ...current, events: [...current.events, ...nextEvents], pageInfo }
        : current);
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoadingMore(false);
    }
  }

  if (state.status === 'loading') return <s-page heading="Activity" inlineSize="large"><LoadingState label="Loading recorded Nexora changes…" /></s-page>;
  if (state.status === 'error') return <s-page heading="Activity" inlineSize="large"><ErrorState error={state.error} onRetry={() => setReloadKey((key) => key + 1)} /></s-page>;

  return (
    <s-page heading="Activity" inlineSize="large">
      <s-button slot="secondary-actions" onClick={() => setReloadKey((key) => key + 1)}>Refresh</s-button>
      <s-stack gap="base">
        <s-banner tone="info" heading="Nexora change history">
          <s-paragraph>
            This log records routing, location-setting, manual reassignment, and automatic order-routing outcomes. Shopify order and fulfillment webhooks are processed only for topics enabled in the deployed app configuration.
          </s-paragraph>
        </s-banner>

        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
          <s-box border="base" borderRadius="large" padding="base">
            <s-stack gap="small-200">
              <s-text color="subdued">Loaded events</s-text>
              <s-heading>{number(state.events.length)}</s-heading>
            </s-stack>
          </s-box>
          <s-box border="base" borderRadius="large" padding="base">
            <s-stack gap="small-200">
              <s-text color="subdued">Matching this view</s-text>
              <s-heading>{number(events.length)}</s-heading>
            </s-stack>
          </s-box>
        </s-grid>

        <s-section padding="none">
          <s-box padding="base">
            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base" alignItems="end">
              <SearchField label="Search activity" placeholder="Search events or subjects" value={query} onInput={setQuery} />
              <Select label="Event type" value={type} options={TYPES} onChange={setType} />
            </s-grid>
          </s-box>
          {events.length === 0 ? (
            <EmptyState
              heading={state.events.length === 0 ? 'No Nexora changes recorded yet' : 'No activity matches'}
              text={state.events.length === 0
                ? 'Routing and location changes made in Nexora will appear here from now on.'
                : 'Try a different search or event type.'}
              action={state.events.length > 0 ? {
                label: 'Clear filters',
                onClick: () => { setQuery(''); setType('all'); setSelectedId(null); },
              } : undefined}
            />
          ) : (
            <s-table>
              <s-table-header-row>
                <s-table-header listSlot="primary">Change</s-table-header>
                <s-table-header>Subject</s-table-header>
                <s-table-header>Summary</s-table-header>
                <s-table-header listSlot="inline">When</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {events.map((event) => (
                  <s-table-row key={event.id}>
                    <s-table-cell>
                      <s-button variant={selectedId === event.id ? 'primary' : 'tertiary'} onClick={() => setSelectedId(event.id)}>{event.typeLabel}</s-button>
                    </s-table-cell>
                    <s-table-cell>{event.subject}</s-table-cell>
                    <s-table-cell>{event.summary}</s-table-cell>
                    <s-table-cell>
                      <s-stack gap="small-200">
                        <s-text>{relative(event.at)}</s-text>
                        <s-text color="subdued">{dateTime(event.at)}</s-text>
                      </s-stack>
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          )}
          {state.pageInfo?.has_next_page && (
            <s-box padding="base">
              <s-button loading={loadingMore} disabled={loadingMore} onClick={loadMore}>Load older changes</s-button>
            </s-box>
          )}
          {loadError && <s-banner tone="critical" heading="Couldn’t load older changes"><s-paragraph>{loadError}</s-paragraph></s-banner>}
        </s-section>

        {selected && (
          <s-section heading="Change details">
            <s-stack gap="base">
              <s-text type="strong">{selected.summary}</s-text>
              <s-text color="subdued">{selected.typeLabel} · {dateTime(selected.at)}</s-text>
            </s-stack>
          </s-section>
        )}
      </s-stack>
    </s-page>
  );
}
