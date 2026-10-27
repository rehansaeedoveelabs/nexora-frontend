import { useNavigate } from 'react-router';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <s-page heading="Page not found">
      <s-section>
        <s-stack gap="base">
          <s-paragraph>This page doesn’t exist in Nexora. It may have moved.</s-paragraph>
          <s-stack direction="inline">
            <s-button variant="primary" onClick={() => navigate('/')}>Go to Home</s-button>
          </s-stack>
        </s-stack>
      </s-section>
    </s-page>
  );
}
