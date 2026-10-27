export function LoadingState({ label = 'Loading…' }) {
  return (
    <s-section>
      <s-stack alignItems="center" gap="base" padding="large-500">
        <s-spinner accessibilityLabel={label} size="large" />
        <s-text color="subdued">{label}</s-text>
      </s-stack>
    </s-section>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <s-banner tone="critical" heading="We couldn’t load this page">
      <s-paragraph>{error?.message ?? 'Something went wrong.'}</s-paragraph>
      {onRetry && <s-button slot="secondary-actions" onClick={onRetry}>Try again</s-button>}
    </s-banner>
  );
}

export function EmptyState({ heading, text, action, icon }) {
  return (
    <s-stack alignItems="center" gap="small" padding="large-500">
      {icon && <s-icon type={icon} tone="subdued" size="base" />}
      <s-heading>{heading}</s-heading>
      <s-box maxInlineSize="440px">
        <s-paragraph color="subdued">{text}</s-paragraph>
      </s-box>
      {action && <s-button variant="primary" onClick={action.onClick}>{action.label}</s-button>}
    </s-stack>
  );
}

/** A bordered, rounded container: the Polaris replacement for hand-written card CSS. */
export function Card({ children, subdued = false, padding = 'base', accent }) {
  return (
    <s-box
      border="base"
      borderRadius="large"
      padding={padding}
      background={subdued ? 'subdued' : 'base'}
      borderColor={accent ? 'strong' : undefined}
    >
      {children}
    </s-box>
  );
}
