import { useEffect } from 'react';
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useNavigate } from 'react-router';
import { SHOPIFY_API_KEY } from './config.js';
import { VizStyles } from './components/charts.jsx';

/**
 * The page shell, written in JSX (React Router turns it into index.html at build time).
 * App Bridge must be the first script in <head>, loaded from Shopify's CDN.
 */
export function Layout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="shopify-api-key" content={SHOPIFY_API_KEY} />
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
        <script src="https://cdn.shopify.com/shopifycloud/polaris.js"></script>
        <style>{`
          html, body { margin: 0; }
          .nx-page-frame { box-sizing: border-box; width: 100%; max-width: 1208px; margin-inline: auto; padding-inline: 4px; }
        `}</style>
        <title>Nexora</title>
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  useAppBridgeNavigation();

  return (
    <>
      <VizStyles />
      {/* Shopify renders these text-only links in the Admin sidebar. The app name itself is Home. */}
      <s-app-nav>
        <s-link href="/" rel="home">Dashboard</s-link>
        <s-link href="/orders">Orders</s-link>
        <s-link href="/locations">Locations</s-link>
        <s-link href="/routing">Routing</s-link>
        <s-link href="/savings">Savings</s-link>
        <s-link href="/capacity">Capacity</s-link>
        <s-link href="/analytics">Analytics</s-link>
        <s-link href="/automations">Automations</s-link>
        <s-link href="/activity">Activity</s-link>
        <s-link href="/settings">Settings</s-link>
      </s-app-nav>
      <div className="nx-page-frame">
        <Outlet />
      </div>
    </>
  );
}

/** Shown while the app's JavaScript loads (SPA mode). */
export function HydrateFallback() {
  return (
    <s-stack alignItems="center" padding="large-200">
      <s-spinner accessibilityLabel="Loading Nexora" size="large" />
    </s-stack>
  );
}

export function ErrorBoundary({ error }) {
  return (
    <s-page heading="Something went wrong" inlineSize="large">
      <s-banner tone="critical" heading="Nexora hit an unexpected error">
        <s-paragraph>{error?.message ?? 'Reload the page to try again.'}</s-paragraph>
      </s-banner>
    </s-page>
  );
}

/**
 * App Bridge fires `shopify:navigate` when a merchant clicks an <s-app-nav> link in the admin
 * sidebar. Hand it to React Router so navigation stays client-side (no full reload).
 */
function useAppBridgeNavigation() {
  const navigate = useNavigate();

  useEffect(() => {
    const onNavigate = async (event) => {
      const href = event.target?.getAttribute?.('href');
      if (!href) return;
      // If a page has unsaved changes, App Bridge's save bar prompts before we leave.
      // It resolves when the merchant confirms, or immediately when no save bar is showing.
      if (window.shopify?.saveBar?.leaveConfirmation) {
        await window.shopify.saveBar.leaveConfirmation();
      }
      navigate(href);
    };

    document.addEventListener('shopify:navigate', onNavigate);
    return () => document.removeEventListener('shopify:navigate', onNavigate);
  }, [navigate]);
}
