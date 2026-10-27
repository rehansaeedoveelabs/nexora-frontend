import { useEffect } from 'react';
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useNavigate } from 'react-router';
import { SHOPIFY_API_KEY } from './config.js';

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
      {/* Admin sidebar menu under "Nexora", read by App Bridge. */}
      <s-app-nav>
        <s-link href="/" rel="home">Home</s-link>
        <s-link href="/locations">Locations</s-link>
        <s-link href="/routing">Routing</s-link>
      </s-app-nav>
      <Outlet />
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
    <s-page heading="Something went wrong">
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
