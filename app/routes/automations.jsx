import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { SearchField, Select } from '../components/fields.jsx';
import { EmptyState } from '../components/states.jsx';

const TEMPLATES = [
  {
    id: 'auto-route-orders',
    title: 'Automatically route eligible new orders',
    description: 'Use saved routing rules, verified inventory, and daily location limits to choose a fulfillment location for eligible new orders.',
    categories: ['Fulfillment', 'Orders'],
    available: true,
    action: 'Configure routing',
    path: '/routing',
  },
  {
    id: 'product-tag-checkout',
    title: 'Restrict checkout locations by product tag',
    description: 'Limit where tagged products can be fulfilled from at checkout using Nexora’s Shopify Function after checkout rules sync successfully.',
    categories: ['Checkout', 'Fulfillment'],
    available: true,
    action: 'Configure routing',
    path: '/routing',
  },
  {
    id: 'keep-orders-together',
    title: 'Keep an order together at checkout',
    description: 'Ask Shopify checkout to keep eligible order lines at the same fulfillment location after checkout rules sync successfully.',
    categories: ['Checkout', 'Orders'],
    available: true,
    action: 'Configure routing',
    path: '/routing',
  },
  {
    id: 'routing-activity',
    title: 'Review automatic routing outcomes',
    description: 'See when Nexora routed an order, left its assignment unchanged, or skipped an unsupported case.',
    categories: ['Orders', 'Monitoring'],
    available: true,
    action: 'View activity',
    path: '/activity',
  },
  {
    id: 'capacity-alert',
    title: 'Get an alert when a location reaches capacity',
    description: 'Send a notification when a location reaches its daily order limit.',
    categories: ['Capacity', 'Notifications'],
    available: false,
  },
  {
    id: 'delayed-reroute',
    title: 'Reroute an unfulfilled order after a wait',
    description: 'Recheck inventory and routing rules when an order remains unfulfilled for a configured time.',
    categories: ['Fulfillment', 'Orders'],
    available: false,
  },
  {
    id: 'routing-skip-alert',
    title: 'Get notified when automatic routing is skipped',
    description: 'Send a message when an order needs manual review because its routing could not be verified.',
    categories: ['Orders', 'Notifications'],
    available: false,
  },
  {
    id: 'late-shipment',
    title: 'Get an alert when a shipment is late',
    description: 'Monitor fulfillment progress and notify your team when a shipment misses its expected date.',
    categories: ['Fulfillment', 'Notifications'],
    available: false,
  },
  {
    id: 'risk-review',
    title: 'Hold high-risk orders for review',
    description: 'Use a risk signal to hold an order before fulfillment begins.',
    categories: ['Risk', 'Orders'],
    available: false,
  },
];

export default function Automations() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('available');

  const templates = useMemo(() => {
    const search = query.trim().toLowerCase();
    return TEMPLATES
      .filter((template) => !search
        || `${template.title} ${template.description} ${template.categories.join(' ')}`.toLowerCase().includes(search))
      .sort((a, b) => sort === 'available'
        ? Number(b.available) - Number(a.available) || a.title.localeCompare(b.title)
        : a.title.localeCompare(b.title));
  }, [query, sort]);

  const implementedCount = TEMPLATES.filter((template) => template.available).length;

  return (
    <s-page heading="Automations" inlineSize="large">
      <style>{`
        .nx-automation-summary {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .nx-automation-stat {
          min-width: 0;
          padding: 14px 16px;
          border: 1px solid var(--p-color-border, #e3e3e3);
          border-radius: 12px;
          background: var(--p-color-bg-surface, #fff);
        }
        .nx-automation-stat strong {
          display: block;
          font-size: 20px;
          line-height: 1.3;
          font-weight: 650;
          font-variant-numeric: tabular-nums;
        }
        .nx-automation-stat span {
          display: block;
          margin-top: 3px;
          color: var(--p-color-text-secondary, #616161);
          font-size: 13px;
        }
        .nx-automation-toolbar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(190px, 240px);
          gap: 12px;
          align-items: end;
        }
        .nx-automation-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          align-items: stretch;
        }
        .nx-automation-card {
          box-sizing: border-box;
          height: 100%;
        }
        .nx-automation-card-content {
          display: flex;
          min-height: 224px;
          height: 100%;
          flex-direction: column;
          gap: 16px;
        }
        .nx-automation-card-title {
          min-height: 42px;
          line-height: 1.4;
        }
        .nx-automation-card-description {
          margin-top: 8px;
          line-height: 1.5;
        }
        .nx-automation-card-footer {
          display: flex;
          flex: 1;
          flex-direction: column;
          align-items: flex-start;
          justify-content: flex-end;
          gap: 14px;
        }
        .nx-automation-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .nx-automation-action {
          width: 100%;
        }
        @media (max-width: 900px) {
          .nx-automation-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 600px) {
          .nx-automation-grid { grid-template-columns: minmax(0, 1fr); }
          .nx-automation-toolbar { grid-template-columns: minmax(0, 1fr); }
          .nx-automation-card-content { min-height: 0; }
          .nx-automation-card-title { min-height: 0; }
        }
      `}</style>
      <s-stack gap="base">
        <s-paragraph color="subdued">
          Explore what Nexora can automate today and what integrations are still needed.
        </s-paragraph>

        <div className="nx-automation-summary" aria-label="Automation availability">
          <div className="nx-automation-stat">
            <strong>{implementedCount}</strong>
            <span>Implemented capabilities</span>
          </div>
          <div className="nx-automation-stat">
            <strong>{TEMPLATES.length - implementedCount}</strong>
            <span>Planned workflows</span>
          </div>
        </div>

        <s-banner tone="info" heading="Automatic routing">
          <s-paragraph>
            When the Shopify order-created webhook and backend queue worker are running, Nexora checks new orders against saved routing rules, verified inventory, and daily location limits. Orders that need multiple locations or cannot be verified are left for review.
          </s-paragraph>
          <s-button slot="secondary-actions" variant="tertiary" onClick={() => navigate('/routing')}>
            Configure routing
          </s-button>
        </s-banner>

        <s-section heading="Templates">
          <s-stack gap="base">
            <div className="nx-automation-toolbar">
              <SearchField
                label="Search automation templates"
                placeholder="Search by name, description, or category"
                value={query}
                onInput={setQuery}
              />
              <Select
                label="Sort templates"
                value={sort}
                options={[
                  { value: 'available', label: 'Implemented first' },
                  { value: 'alphabetical', label: 'Alphabetical' },
                ]}
                onChange={setSort}
              />
            </div>

            {templates.length === 0 ? (
              <EmptyState
                heading="No templates match your search"
                text="Try another name or category."
                action={{ label: 'Clear search', onClick: () => setQuery('') }}
              />
            ) : (
              <div className="nx-automation-grid" aria-live="polite">
                {templates.map((template) => (
                  <s-box
                    key={template.id}
                    className="nx-automation-card"
                    border="base"
                    borderRadius="large"
                    padding="base"
                    background={template.available ? 'base' : 'subdued'}
                  >
                    <div className="nx-automation-card-content">
                      <div>
                        <s-heading className="nx-automation-card-title">{template.title}</s-heading>
                        <s-paragraph className="nx-automation-card-description" color="subdued">{template.description}</s-paragraph>
                      </div>
                      <div className="nx-automation-card-footer">
                        <div className="nx-automation-badges">
                          {template.categories.map((category) => (
                            <s-badge key={category} tone="info">{category}</s-badge>
                          ))}
                          <s-badge tone={template.available ? 'success' : 'attention'}>
                            {template.available ? 'Implemented' : 'Not available yet'}
                          </s-badge>
                        </div>
                        {template.available ? (
                          <s-button className="nx-automation-action" variant="secondary" onClick={() => navigate(template.path)}>
                            {template.action}
                          </s-button>
                        ) : (
                          <s-button className="nx-automation-action" disabled>Coming later</s-button>
                        )}
                      </div>
                    </div>
                  </s-box>
                ))}
              </div>
            )}
          </s-stack>
        </s-section>

        <s-stack alignItems="center">
          <s-link href="https://help.shopify.com/en/manual/shopify-flow" target="_blank">
            Learn about Shopify Flow
          </s-link>
        </s-stack>
      </s-stack>
    </s-page>
  );
}
