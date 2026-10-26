import { html } from '../lib/html.js';

export function LoadingState({ label = 'Loading…' }) {
  return html`
    <s-section>
      <div className="nx-center">
        <s-spinner accessibilityLabel=${label} size="large" />
        <s-text color="subdued">${label}</s-text>
      </div>
    </s-section>
  `;
}

export function ErrorState({ error, onRetry }) {
  return html`
    <s-banner tone="critical" heading="We couldn’t load this page">
      <s-paragraph>${error?.message ?? 'Something went wrong.'}</s-paragraph>
      ${onRetry && html`<s-button slot="secondary-actions" onClick=${onRetry}>Try again</s-button>`}
    </s-banner>
  `;
}

export function EmptyState({ heading, text, action }) {
  return html`
    <div className="nx-empty">
      <s-heading>${heading}</s-heading>
      <s-paragraph color="subdued">${text}</s-paragraph>
      ${action && html`<s-button onClick=${action.onClick}>${action.label}</s-button>`}
    </div>
  `;
}
