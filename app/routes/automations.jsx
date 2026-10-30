import { useNavigate } from 'react-router';

export default function Automations() {
  const navigate = useNavigate();

  return (
    <s-page heading="Automations" inlineSize="large">
      <s-stack gap="base">
        <s-banner tone="warning" heading="Automation execution is not configured">
          <s-paragraph>
            No scheduled tasks, Shopify Flow actions, notification delivery, or automated order updates are currently running. Nexora does not show demo switches as if they were active workflows.
          </s-paragraph>
        </s-banner>

        <s-section heading="Integrations required">
          <s-stack gap="base">
            <s-paragraph>Subscribe to and persist the Shopify order and fulfillment events that should trigger workflows.</s-paragraph>
            <s-paragraph>Define each workflow’s trigger, conditions, action, retry policy and audit record.</s-paragraph>
            <s-paragraph>Connect a verified notification provider before enabling email or messaging actions.</s-paragraph>
          </s-stack>
        </s-section>

        <s-section heading="Available operational data">
          <s-stack direction="inline" gap="base">
            <s-button variant="primary" onClick={() => navigate('/capacity')}>Review live capacity</s-button>
            <s-button onClick={() => navigate('/activity')}>Review Nexora changes</s-button>
            <s-button onClick={() => navigate('/settings/notifications')}>Notification setup status</s-button>
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}
