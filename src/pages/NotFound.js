import { useNavigate } from 'react-router';
import { html } from '../lib/html.js';

export function NotFound() {
  const navigate = useNavigate();

  return html`
    <s-page heading="Page not found">
      <s-section>
        <s-paragraph>This page doesn’t exist in Nexora. It may have moved.</s-paragraph>
        <s-button variant="primary" onClick=${() => navigate('/')}>Go to Home</s-button>
      </s-section>
    </s-page>
  `;
}
