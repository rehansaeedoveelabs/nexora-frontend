import { useNavigate } from 'react-router';

export default function Savings() {
  const navigate = useNavigate();

  return (
    <s-page heading="Shipping savings" inlineSize="large">
      <s-button slot="secondary-actions" onClick={() => navigate('/analytics')}>View live analytics</s-button>
      <s-stack gap="base">
        <s-banner tone="info" heading="Savings are not yet measurable">
          <s-paragraph>
            Nexora does not currently have verified carrier-rate quotes or actual carrier charges to compare. Shopify shipping amounts are what customers paid at checkout; they are not the merchant’s carrier costs, so they cannot prove savings.
          </s-paragraph>
        </s-banner>

        <s-section heading="What is needed for a reliable savings report">
          <s-stack gap="base">
            <s-paragraph>1. Collect comparable shipping-rate quotes for each eligible fulfillment location.</s-paragraph>
            <s-paragraph>2. Store the quote selected for each order alongside the routing decision.</s-paragraph>
            <s-paragraph>3. Reconcile selected rates against actual carrier charges before reporting realized savings.</s-paragraph>
            <s-paragraph color="subdued">
              Until those inputs are connected, Nexora intentionally does not display demo estimates as merchant savings.
            </s-paragraph>
          </s-stack>
        </s-section>

        <s-section heading="Use live operational data">
          <s-stack direction="inline" gap="base">
            <s-button variant="primary" onClick={() => navigate('/orders')}>Review Shopify orders</s-button>
            <s-button onClick={() => navigate('/routing')}>Review routing configuration</s-button>
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}
