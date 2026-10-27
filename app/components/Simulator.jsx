import { useState } from 'react';
import { api, toast } from '../lib/api.js';
import { plural, splitTags } from '../lib/format.js';
import { NumberField, TextField } from './fields.jsx';
import { Card } from './states.jsx';

let lineCounter = 0;

function newLine(locations, title = 'Sample product') {
  lineCounter += 1;
  return {
    key: lineCounter,
    title,
    quantity: '1',
    tagsText: '',
    stock: Object.fromEntries(locations.map((l) => [l.id, '10'])),
  };
}

const FIELD_GRID = 'repeat(auto-fit, minmax(180px, 1fr))';

/**
 * "Test an order": runs a sample order through the routing engine with the CURRENT (unsaved)
 * settings and explains, in sentences, where it ships and why every other location was skipped.
 */
export function Simulator({ locations, draftPayload, isPlus }) {
  const [destination, setDestination] = useState({ country: 'US', province: '' });
  const [lines, setLines] = useState(() => [newLine(locations)]);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);

  const setLine = (key, patch) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  async function run() {
    setRunning(true);
    try {
      const { data } = await api.post('/routing/simulate', {
        settings: draftPayload,
        destination: { country_code: destination.country.trim(), province_code: destination.province.trim() || null },
        lines: lines.map((l) => ({
          title: l.title.trim() || 'Product',
          quantity: Number(l.quantity) || 0,
          tags: splitTags(l.tagsText),
          stock: Object.fromEntries(Object.entries(l.stock).map(([id, v]) => [id, Number(v) || 0])),
        })),
      });
      setResult(data);
    } catch (error) {
      if (error.status !== 422) {
        toast(error.message, true);
      } else if (Object.keys(error.fieldErrors).some((field) => field.startsWith('settings.'))) {
        toast('The routing settings above have a problem. Fix it, then run the test again.', true);
      } else {
        toast('Check the test order: every product needs a name and a quantity of at least 1, and the country must be a 2-letter code.', true);
      }
    } finally {
      setRunning(false);
    }
  }

  return (
    <s-section heading="Test an order">
      <s-stack gap="base">
        <s-paragraph color="subdued">
          Build a sample order and see exactly where it would ship from, and why. It uses the settings on this page,
          including changes you haven’t saved yet. Stock levels here are pretend, so try out-of-stock situations freely.
        </s-paragraph>

        <s-grid gridTemplateColumns={FIELD_GRID} gap="base" alignItems="start">
          <TextField
            label="Customer country"
            placeholder="US"
            value={destination.country}
            details="2-letter code, e.g. US, CA, PK"
            onInput={(country) => setDestination((d) => ({ ...d, country }))}
          />
          <TextField
            label="State or province (optional)"
            placeholder="MN"
            value={destination.province}
            details="Code, e.g. MN, ON, PB"
            onInput={(province) => setDestination((d) => ({ ...d, province }))}
          />
        </s-grid>

        {lines.map((line, index) => (
          <Card key={line.key}>
            <s-stack gap="base">
              <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                <s-stack direction="inline" gap="small-200" alignItems="center">
                  <s-icon type="product" tone="subdued" />
                  <s-text type="strong">Product {index + 1}</s-text>
                </s-stack>
                {lines.length > 1 && (
                  <s-button
                    variant="tertiary"
                    tone="critical"
                    icon="delete"
                    accessibilityLabel={`Remove product ${index + 1}`}
                    onClick={() => setLines((ls) => ls.filter((l) => l.key !== line.key))}
                  />
                )}
              </s-stack>
              <s-grid gridTemplateColumns={FIELD_GRID} gap="base" alignItems="start">
                <TextField label="Product name" value={line.title} onInput={(title) => setLine(line.key, { title })} />
                <NumberField label="Quantity" value={line.quantity} min={1} max={9999} onInput={(quantity) => setLine(line.key, { quantity })} />
                <TextField
                  label="Product tags"
                  placeholder="e.g. fragile"
                  value={line.tagsText}
                  details="Comma-separated, like in Shopify"
                  onInput={(tagsText) => setLine(line.key, { tagsText })}
                />
              </s-grid>
              <s-text color="subdued">Stock at each location</s-text>
              <s-grid gridTemplateColumns={FIELD_GRID} gap="base" alignItems="start">
                {locations.map((l) => (
                  <NumberField
                    key={l.id}
                    label={l.name}
                    min={0}
                    max={1000000}
                    value={line.stock[l.id] ?? '0'}
                    onInput={(value) => setLine(line.key, { stock: { ...line.stock, [l.id]: value } })}
                  />
                ))}
              </s-grid>
            </s-stack>
          </Card>
        ))}

        <s-stack direction="inline" gap="base">
          <s-button icon="plus" onClick={() => setLines((ls) => [...ls, newLine(locations, `Product ${ls.length + 1}`)])}>Add product</s-button>
          <s-button variant="primary" icon="play" loading={running} onClick={run}>Run test</s-button>
        </s-stack>

        {result && <SimulationResult result={result} isPlus={isPlus} />}
      </s-stack>
    </s-section>
  );
}

function SimulationResult({ result, isPlus }) {
  return (
    <s-stack gap="base">
      <s-divider />
      <OutcomeBanner result={result} />

      {result.warnings.filter((w) => w.tone === 'critical').map((w) => (
        <s-banner key={w.code + (w.rule_id ?? '')} tone="critical"><s-paragraph>{w.message}</s-paragraph></s-banner>
      ))}

      {!isPlus && result.outcome !== 'blocked' && (
        <s-paragraph color="subdued">
          On your plan, Shopify may pick a different location among those that can ship this order. Your product rules and
          “keep orders together” setting still apply.
        </s-paragraph>
      )}

      <s-heading>How each location was considered</s-heading>
      {result.locations.map((location) => (
        <Card key={location.id}>
          <s-stack gap="small-200">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-text type="strong">{location.rank}. {location.name}</s-text>
              <CapabilityBadge location={location} result={result} />
            </s-stack>
            {location.reasons.length > 0 ? (
              <s-unordered-list>
                {location.reasons.map((r, i) => <s-list-item key={i}>{r.message}</s-list-item>)}
              </s-unordered-list>
            ) : (
              <s-text color="subdued">Has everything in stock and no rule blocks it.</s-text>
            )}
          </s-stack>
        </Card>
      ))}
    </s-stack>
  );
}

function OutcomeBanner({ result }) {
  const messages = result.reasons.map((r, i) => <s-paragraph key={i}>{r.message}</s-paragraph>);

  if (result.outcome === 'single') {
    return (
      <s-banner tone="success" heading={`Ships from ${result.shipments[0].location_name} in one package`}>
        {messages}
      </s-banner>
    );
  }

  if (result.outcome === 'split') {
    return (
      <s-banner tone="info" heading={`Ships in ${plural(result.shipments.length, 'package')}`}>
        <s-unordered-list>
          {result.shipments.map((s) => (
            <s-list-item key={s.location}>{s.location_name}: {s.line_titles.join(', ')}</s-list-item>
          ))}
        </s-unordered-list>
        {messages}
      </s-banner>
    );
  }

  return (
    <s-banner tone="critical" heading="This order couldn’t be placed">
      {messages}
    </s-banner>
  );
}

function CapabilityBadge({ location, result }) {
  const shipped = result.shipments.some((s) => s.location === location.id);
  if (shipped) return <s-badge tone="success">Ships {result.outcome === 'split' ? 'part of ' : ''}this order</s-badge>;
  if (location.ships_everything) return <s-badge>Could ship everything</s-badge>;
  if (location.can_ship.length > 0) return <s-badge tone="warning">Could ship part</s-badge>;
  return <s-badge tone="critical">Can’t ship this order</s-badge>;
}
