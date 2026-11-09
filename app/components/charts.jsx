/**
 * Hand-rolled SVG charts — no chart library, so nothing new to ship and everything themes with the
 * Polaris admin. Colours come from the validated data-viz palette, declared once as CSS custom
 * properties on `.nx-viz` (see VizStyles / root.jsx) so light and dark swap in one place. Identity
 * is never colour-alone: every multi-series chart carries a legend and direct/axis labels, and each
 * mark has a native <title> tooltip.
 */

// Primary text inherits the Polaris surface's own text colour (currentColor), so it is always
// legible whatever theme the admin renders in. Muted grey is theme-invariant by design.
const INK = 'currentColor';
const MUTED = 'var(--nx-muted)';
const GRID = 'var(--nx-grid)';
const AXIS = 'var(--nx-axis)';

export const SERIES = ['var(--nx-s1)', 'var(--nx-s2)', 'var(--nx-s3)'];
export const BASELINE = 'var(--nx-baseline)';
export const STATUS = { good: 'var(--nx-good)', warning: 'var(--nx-warning)', serious: 'var(--nx-serious)', critical: 'var(--nx-critical)' };

/** Inject the viz tokens once. Rendered high in the tree (root). */
export function VizStyles() {
  return (
    <style>{`
.nx-viz{
  --nx-surface:#fcfcfb;--nx-ink:#0b0b0b;--nx-muted:#898781;--nx-grid:#e1e0d9;--nx-axis:#c3c2b7;
  --nx-s1:#2a78d6;--nx-s2:#eb6834;--nx-s3:#1baf7a;--nx-baseline:#898781;
  --nx-good:#0ca30c;--nx-warning:#fab219;--nx-serious:#ec835a;--nx-critical:#d03b3b;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .nx-viz{
  --nx-surface:#1a1a19;--nx-ink:#f0efec;--nx-muted:#898781;--nx-grid:#2c2c2a;--nx-axis:#383835;
  --nx-s1:#3987e5;--nx-s2:#d95926;--nx-s3:#199e70;--nx-baseline:#c3c2b7;
}}
:root[data-theme="dark"] .nx-viz{
  --nx-surface:#1a1a19;--nx-ink:#f0efec;--nx-muted:#898781;--nx-grid:#2c2c2a;--nx-axis:#383835;
  --nx-s1:#3987e5;--nx-s2:#d95926;--nx-s3:#199e70;--nx-baseline:#c3c2b7;
}
.nx-viz svg{display:block;width:100%;height:auto}
.nx-viz__plot{max-width:760px;margin-inline:auto}
.nx-viz__donut{max-width:148px;margin-inline:auto}
.nx-viz .nx-bar{transition:opacity .12s}
.nx-viz .nx-bar:hover{opacity:.78}
.nx-viz .nx-bar-mark{transform-box:fill-box;transform-origin:center bottom;animation:nx-bar-grow .8s cubic-bezier(.2,.7,.2,1) both}
.nx-viz .nx-line-draw{animation:nx-line-draw .9s ease-out both}
.nx-viz .nx-donut-segment{animation:nx-donut-fill 1s cubic-bezier(.2,.7,.2,1) both}
.nx-viz .nx-meter-fill{transform-box:fill-box;transform-origin:left center;animation:nx-meter-fill .9s ease-out both}
@keyframes nx-bar-grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes nx-line-draw{from{stroke-dashoffset:1000}to{stroke-dashoffset:0}}
@keyframes nx-donut-fill{from{stroke-dasharray:0 var(--nx-donut-circ)}to{stroke-dasharray:var(--nx-donut-length) var(--nx-donut-circ)}}
@keyframes nx-meter-fill{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@media(prefers-reduced-motion:reduce){
  .nx-viz .nx-bar-mark,.nx-viz .nx-line-draw,.nx-viz .nx-donut-segment,.nx-viz .nx-meter-fill{animation:none}
}
`}</style>
  );
}

function niceMax(value) {
  if (value <= 0) return 10;
  const pow = 10 ** Math.floor(Math.log10(value));
  const n = value / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

/** A small legend row (HTML, so it inherits Polaris text styling). */
export function Legend({ items }) {
  return (
    <s-stack direction="inline" gap="base" alignItems="center">
      {items.map((it) => (
        <s-stack key={it.label} direction="inline" gap="small-300" alignItems="center">
          <span style={{ width: 10, height: 10, borderRadius: 2, background: it.color, display: 'inline-block' }} />
          <s-text color="subdued">{it.label}</s-text>
        </s-stack>
      ))}
    </s-stack>
  );
}

/**
 * Multi-series line chart.
 * series: [{ name, color, dashed, values: number[] }]; labels: string[]; format: (n)=>string
 */
export function LineChart({ labels = [], series = [], format = (n) => n, height = 176 }) {
  if (labels.length === 0 || series.length === 0) return <ChartEmpty />;

  const W = 640;
  const H = height;
  const padL = 48;
  const padR = 14;
  const padT = 14;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values.filter((v) => v != null))));
  const n = labels.length;
  const x = (i) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v) => padT + plotH - (v / max) * plotH;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t));

  return (
    <div className="nx-viz">
      <Legend items={series.map((s) => ({ label: s.name, color: s.color }))} />
      <svg className="nx-viz__plot" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={series.map((s) => s.name).join(' versus ')}>
        {ticks.map((t, i) => (
          <g key={`${t}-${i}`}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
            <text x={padL - 8} y={y(t) + 3} textAnchor="end" fontSize="11" fill={MUTED} style={{ fontVariantNumeric: 'tabular-nums' }}>{format(t)}</text>
          </g>
        ))}
        {labels.map((lab, i) => (
          (n <= 10 || i % 2 === 0) && (
            <text key={lab + i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill={MUTED}>{lab}</text>
          )
        ))}
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v == null ? null : `${x(i)},${y(v)}`)).filter(Boolean).join(' ');
          return (
            <g key={s.name}>
              <polyline
                points={pts}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={s.dashed ? '5 4' : '1000'}
                className={s.dashed ? undefined : 'nx-line-draw'}
                pathLength={s.dashed ? undefined : 1000}
              />
              {s.values.map((v, i) => (v == null ? null : (
                <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill="var(--nx-surface)" stroke={s.color} strokeWidth="2">
                  <title>{`${s.name} · ${labels[i]}: ${format(v)}`}</title>
                </circle>
              )))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Single-series vertical bars. data: [{ label, value }]. */
export function BarChart({ data = [], format = (n) => n, color = SERIES[0], height = 176 }) {
  if (data.length === 0) return <ChartEmpty />;

  const W = 640;
  const H = height;
  const padL = 48;
  const padR = 14;
  const padT = 14;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)));
  const slot = plotW / data.length;
  const barW = Math.min(46, slot * 0.6);
  const y = (v) => padT + plotH - (v / max) * plotH;
  const ticks = [0, 0.5, 1].map((t) => Math.round(max * t));

  return (
    <div className="nx-viz">
      <svg className="nx-viz__plot" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bar chart">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
            <text x={padL - 8} y={y(t) + 3} textAnchor="end" fontSize="11" fill={MUTED} style={{ fontVariantNumeric: 'tabular-nums' }}>{format(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = padL + slot * i + slot / 2;
          const barH = (d.value / max) * plotH;
          return (
            <g key={d.label} className="nx-bar">
              <rect
                className="nx-bar-mark"
                style={{ animationDelay: `${Math.min(i * 35, 280)}ms` }}
                x={cx - barW / 2}
                y={y(d.value)}
                width={barW}
                height={Math.max(0, barH)}
                rx="3"
                fill={color}
              >
                <title>{`${d.label}: ${format(d.value)}`}</title>
              </rect>
              <text x={cx} y={y(d.value) - 6} textAnchor="middle" fontSize="11" fill={INK} style={{ fontVariantNumeric: 'tabular-nums' }}>{format(d.value)}</text>
              <text x={cx} y={H - 9} textAnchor="middle" fontSize="11" fill={MUTED}>{truncate(d.label)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function truncate(s, n = 12) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** Donut with centre total. data: [{ label, value }] (<=3 slices for colour safety). */
export function DonutChart({ data = [], centerLabel, format = (n) => n }) {
  if (data.length === 0 || data.every((item) => item.value <= 0)) return <ChartEmpty />;

  const size = 148;
  const stroke = 20;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const circ = 2 * Math.PI * r;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let offset = 0;

  return (
    <div className="nx-viz">
      <s-grid gridTemplateColumns="minmax(120px, 148px) minmax(0, 1fr)" gap="base" alignItems="center">
        <svg className="nx-viz__donut" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Distribution donut chart">
          <circle cx={cx} cy={cx} r={r} fill="none" stroke={GRID} strokeWidth={stroke} />
          {data.map((d, i) => {
            const frac = d.value / total;
            const len = frac * circ;
            const seg = (
              <circle
                key={d.label}
                className="nx-donut-segment"
                style={{
                  '--nx-donut-length': Math.max(0, len - 2),
                  '--nx-donut-circ': circ,
                  animationDelay: `${i * 120}ms`,
                }}
                cx={cx}
                cy={cx}
                r={r}
                fill="none"
                stroke={SERIES[i % SERIES.length]}
                strokeWidth={stroke}
                strokeDasharray={`${Math.max(0, len - 2)} ${circ}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${cx} ${cx})`}
              >
                <title>{`${d.label}: ${format(d.value)} (${Math.round(frac * 100)}%)`}</title>
              </circle>
            );
            offset += len;
            return seg;
          })}
          <text x={cx} y={cx - 2} textAnchor="middle" fontSize="20" fontWeight="600" fill={INK} style={{ fontVariantNumeric: 'tabular-nums' }}>{format(total)}</text>
          {centerLabel && <text x={cx} y={cx + 16} textAnchor="middle" fontSize="11" fill={MUTED}>{centerLabel}</text>}
        </svg>
        <s-stack gap="small-300">
          {data.map((d, i) => (
            <s-stack key={d.label} direction="inline" gap="small-300" alignItems="center">
              <span style={{ width: 10, height: 10, borderRadius: 2, background: SERIES[i % SERIES.length], display: 'inline-block' }} />
              <s-text>{d.label}</s-text>
              <s-text color="subdued">{format(d.value)} · {Math.round((d.value / total) * 100)}%</s-text>
            </s-stack>
          ))}
        </s-stack>
      </s-grid>
    </div>
  );
}

/** Tiny inline trend line for KPI cards. */
export function Sparkline({ values = [], color = SERIES[0], width = 120, height = 34 }) {
  if (values.length === 0) return null;

  const max = Math.max(1, ...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const x = (i) => (values.length === 1 ? width / 2 : (i / (values.length - 1)) * (width - 4) + 2);
  const y = (v) => height - 3 - ((v - min) / span) * (height - 6);
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  return (
    <div className="nx-viz" style={{ width }}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Trend">
        {values.length === 1
          ? <circle cx={x(0)} cy={y(values[0])} r="2.5" fill={color} />
          : <polyline className="nx-line-draw" pathLength="1000" strokeDasharray="1000" points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
      </svg>
    </div>
  );
}

/** Horizontal utilization meter, coloured by threshold. */
export function Meter({ value, warnAt = 0.75, criticalAt = 0.9, label }) {
  const pct = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  const color = pct >= criticalAt ? STATUS.critical : pct >= warnAt ? STATUS.warning : STATUS.good;
  return (
    <div className="nx-viz" style={{ width: '100%' }}>
      <svg viewBox="0 0 100 10" preserveAspectRatio="none" role="img" aria-label={label ?? 'Utilization'} style={{ height: 10 }}>
        <rect x="0" y="0" width="100" height="10" rx="5" fill={GRID} />
        <rect className="nx-meter-fill" x="0" y="0" width={pct * 100} height="10" rx="5" fill={color} />
      </svg>
    </div>
  );
}

function ChartEmpty() {
  return (
    <s-box padding="large-200" background="subdued" borderRadius="base">
      <s-text color="subdued">No chart data available for this period.</s-text>
    </s-box>
  );
}
