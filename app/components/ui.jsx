import { useRef } from 'react';
import { Sparkline } from './charts.jsx';
import { delta as fmtDelta } from '../lib/format.js';

/**
 * Cross-page building blocks: KPI tiles, status badges, confirm dialog and a definition list.
 * All built from Polaris web components so they inherit admin theming.
 */

/** A KPI tile: big number, optional comparison delta and sparkline. */
export function KpiCard({ label, value, help, delta, deltaGood = true, spark, onClick }) {
  const positive = delta != null && delta >= 0;
  const good = positive === deltaGood;
  const body = (
    <s-stack gap="small-200">
      <s-text color="subdued">{label}</s-text>
      <s-stack direction="inline" gap="small" alignItems="baseline">
        <s-heading>{value}</s-heading>
        {delta != null && (
          <s-text tone={good ? 'success' : 'critical'}>
            {fmtDelta(delta)}
          </s-text>
        )}
      </s-stack>
      {spark ? <Sparkline values={spark} /> : null}
      {help ? <s-text color="subdued">{help}</s-text> : null}
    </s-stack>
  );

  if (onClick) {
    return (
      <s-clickable border="base" borderRadius="large" padding="base" onClick={onClick} accessibilityLabel={`${label}: ${value}`}>
        {body}
      </s-clickable>
    );
  }
  return <s-box border="base" borderRadius="large" padding="base">{body}</s-box>;
}

const BADGES = {
  routing: {
    routed: ['success', 'status-active', 'Routed'],
    rerouted: ['info', 'transfer', 'Rerouted'],
    needs_review: ['warning', 'alert-triangle', 'Needs review'],
    pending: ['neutral', 'clock', 'Routing pending'],
  },
  fulfillment: {
    fulfilled: ['success', 'check-circle', 'Fulfilled'],
    pending: ['warning', 'clock', 'Fulfillment pending'],
    unfulfilled: ['neutral', 'incomplete', 'Unfulfilled'],
    cancelled: ['neutral', undefined, 'Cancelled'],
  },
  forecast: {
    ok: ['success', 'check-circle', 'Healthy'],
    watch: ['warning', 'alert-triangle', 'Watch'],
    overload: ['critical', 'alert-triangle', 'Overload risk'],
    unconfigured: ['neutral', undefined, 'Set daily limit'],
  },
  inventory: {
    healthy: ['success', 'check-circle', 'Healthy stock'],
    low: ['warning', 'alert-triangle', 'Low stock'],
    critical: ['critical', 'alert-triangle', 'Critical stock'],
  },
  result: {
    success: ['success', 'check-circle', 'Success'],
    info: ['info', 'transfer', 'Info'],
    warning: ['warning', 'alert-triangle', 'Warning'],
  },
};

/** Consistent status badge across the app. Falls back to a neutral badge for unknown values. */
export function StatusBadge({ kind, value, label }) {
  const [tone, icon, defaultLabel] = BADGES[kind]?.[value] ?? ['neutral', undefined, value];
  return <s-badge tone={tone} icon={icon}>{label ?? defaultLabel}</s-badge>;
}

/** A definition list for detail panels: [[term, value], ...]. */
export function DetailList({ rows }) {
  return (
    <s-stack gap="small-200">
      {rows.map(([term, value]) => (
        <s-grid key={term} gridTemplateColumns="140px 1fr" gap="base" alignItems="start">
          <s-text color="subdued">{term}</s-text>
          <s-text>{value}</s-text>
        </s-grid>
      ))}
    </s-stack>
  );
}

/**
 * Always-mounted confirmation modal. Open it with a button carrying commandFor={id} command="--show",
 * set the pending action via onConfirm. Used for destructive actions (delete, reroute).
 */
export function ConfirmDialog({ id, heading, body, confirmLabel = 'Confirm', tone = 'critical', busy = false, onConfirm }) {
  const modal = useRef(null);
  const run = async () => {
    await onConfirm?.();
    modal.current?.hideOverlay();
  };
  return (
    <s-modal ref={modal} id={id} heading={heading}>
      <s-stack gap="base">
        <s-paragraph>{body}</s-paragraph>
      </s-stack>
      <s-button slot="secondary-actions" commandFor={id} command="--hide">Cancel</s-button>
      <s-button slot="primary-action" variant="primary" tone={tone} loading={busy} onClick={run}>{confirmLabel}</s-button>
    </s-modal>
  );
}
