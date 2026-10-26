import { useEffect } from 'react';
import { Route, Routes, useNavigate } from 'react-router';
import { html } from './lib/html.js';
import { Home } from './pages/Home.js';
import { Locations } from './pages/Locations.js';
import { NotFound } from './pages/NotFound.js';

export function App() {
  useAppBridgeNavigation();

  return html`
    <${Routes}>
      <${Route} path="/" element=${html`<${Home} />`} />
      <${Route} path="/locations" element=${html`<${Locations} />`} />
      <${Route} path="*" element=${html`<${NotFound} />`} />
    <//>
  `;
}

/**
 * App Bridge fires `shopify:navigate` when a merchant clicks an <s-app-nav> link in the admin
 * sidebar. Hand it to React Router so navigation stays client-side (no full reload).
 */
function useAppBridgeNavigation() {
  const navigate = useNavigate();

  useEffect(() => {
    const onNavigate = (event) => {
      const href = event.target?.getAttribute?.('href');
      if (href) navigate(href);
    };

    document.addEventListener('shopify:navigate', onNavigate);
    return () => document.removeEventListener('shopify:navigate', onNavigate);
  }, [navigate]);
}
