import { LOCATION_TYPE_LABEL } from '../mocks/locations-data.js';

/**
 * A small, transparent demo routing engine. Given a sample order and the locations, it ranks
 * candidates and explains the choice in plain language. It is deliberately simple and deterministic
 * — not a reproduction of Shopify's internal routing — so merchants can see exactly why a location
 * won. The real engine (Rust Function + Laravel) replaces this later; the shape of the result is
 * what the UI depends on.
 *
 * order: { items: [{ title, tag, qty, stock?: {locId: n} }], destination: { country }, value? }
 * options: { objective, noSplit, excludeOverloaded }
 */
export function simulateRouting(order, locations, options = {}) {
  const { objective = 'lowest_cost', excludeOverloaded = true } = options;
  const active = locations.filter((l) => l.active);

  const candidates = active.map((loc) => {
    const reasons = [];
    let eligible = true;

    // Fragile items may only ship from warehouses / 3PLs.
    const fragile = order.items.some((it) => it.tag === 'fragile');
    if (fragile && loc.type === 'store') {
      eligible = false;
      reasons.push('Fragile items are restricted to warehouses.');
    }

    // Capacity (only when the location carries a live load; the seed generator passes none).
    const hasLoad = typeof loc.ordersToday === 'number';
    const utilization = hasLoad ? loc.ordersToday / loc.dailyCap : 0;
    if (hasLoad) {
      if (loc.ordersToday >= loc.dailyCap && excludeOverloaded) {
        eligible = false;
        reasons.push('At or above daily capacity.');
      } else if (utilization >= 0.9) {
        reasons.push('Near daily capacity (90%+).');
      }
    }

    // Stock (optional per-line stock map from the simulator UI).
    const outOfStock = order.items.some((it) => {
      const stock = it.stock?.[loc.id];
      return stock !== undefined && stock < it.qty;
    });
    if (outOfStock) {
      eligible = false;
      reasons.push('Not enough stock for one or more items.');
    }

    // Estimated shipping cost: base + distance penalty when outside the destination country.
    const distancePenalty = loc.country === order.destination?.country ? 0 : 6;
    const shippingEstimate = Number((loc.avgShipCost + distancePenalty).toFixed(2));

    if (eligible && reasons.length === 0) reasons.push('Eligible: in stock, has capacity, no rule blocks it.');

    return {
      locationId: loc.id,
      name: loc.name,
      type: loc.type,
      typeLabel: LOCATION_TYPE_LABEL[loc.type],
      eligible,
      shippingEstimate,
      utilization,
      reasons,
    };
  });

  const score = (c) => {
    switch (objective) {
      case 'lowest_utilization': return c.utilization;
      case 'nearest': return c.shippingEstimate; // distance ≈ cost here
      default: return c.shippingEstimate;
    }
  };

  const ranked = [...candidates].sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    return score(a) - score(b);
  }).map((c, i) => ({ ...c, rank: i + 1 }));

  const selected = ranked.find((c) => c.eligible) ?? null;
  const alternatives = ranked.filter((c) => c !== selected);

  let explanation;
  if (!selected) {
    explanation = 'No location is eligible for this order, so it needs manual review. '
      + 'Check stock levels and fulfillment rules for the items above.';
  } else {
    const cheaper = alternatives.filter((a) => a.eligible && a.shippingEstimate > selected.shippingEstimate);
    explanation = `${selected.name} was selected because it is eligible and offers the `
      + `${objective === 'lowest_utilization' ? 'lowest capacity utilization' : 'lowest estimated shipping cost'} `
      + `($${selected.shippingEstimate.toFixed(2)}) among the candidates`
      + (cheaper.length ? `, beating ${cheaper.length} more expensive eligible location${cheaper.length > 1 ? 's' : ''}.` : '.');
  }

  return {
    outcome: selected ? 'routed' : 'manual_review',
    selected,
    alternatives,
    ranked,
    explanation,
  };
}
