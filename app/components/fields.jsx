import { useEffect, useRef } from 'react';

/**
 * React wrappers for Polaris form web components.
 *
 * Polaris fields emit native `change` / `input` events on the element itself; React's synthetic
 * onChange only covers built-in <input>/<select>, so we attach real listeners via a ref and keep
 * `value` / `checked` in sync as element properties.
 */

function useListener(ref, type, handler) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !handler) return undefined;
    el.addEventListener(type, handler);
    return () => el.removeEventListener(type, handler);
  }, [ref, type, handler]);
}

function useProperty(ref, name, value) {
  useEffect(() => {
    const el = ref.current;
    if (el && value !== undefined && el[name] !== value) el[name] = value;
  }, [ref, name, value]);
}

export function Select({ label, value, options, onChange, hideLabel = false, error, details }) {
  const ref = useRef(null);
  useProperty(ref, 'value', value ?? '');
  useListener(ref, 'change', onChange && ((e) => onChange(e.currentTarget.value)));

  return (
    <s-select
      ref={ref}
      label={label}
      labelAccessibilityVisibility={hideLabel ? 'exclusive' : 'visible'}
      error={error || undefined}
      details={details}
    >
      {options.map((o) => (
        <s-option key={o.value} value={o.value} selected={o.value === (value ?? '')}>{o.label}</s-option>
      ))}
    </s-select>
  );
}

export function SearchField({ label, value, placeholder, onInput }) {
  const ref = useRef(null);
  useProperty(ref, 'value', value);
  useListener(ref, 'input', onInput && ((e) => onInput(e.currentTarget.value)));

  return <s-search-field ref={ref} label={label} labelAccessibilityVisibility="exclusive" placeholder={placeholder} />;
}

/** Checkbox without a visible label (table row selection). */
export function Checkbox({ label, checked, onChange }) {
  const ref = useRef(null);
  useProperty(ref, 'checked', checked);
  useListener(ref, 'change', onChange && ((e) => onChange(e.currentTarget.checked)));

  return <s-checkbox ref={ref} accessibilityLabel={label} />;
}

/** Checkbox with a visible label and optional help text (settings-style). */
export function Toggle({ label, details, checked, onChange }) {
  const ref = useRef(null);
  useProperty(ref, 'checked', checked);
  useListener(ref, 'change', onChange && ((e) => onChange(e.currentTarget.checked)));

  return <s-checkbox ref={ref} label={label} details={details} />;
}

/** On/off setting using Polaris s-switch (the premium toggle used across Shopify settings). */
export function Switch({ label, details, checked, onChange }) {
  const ref = useRef(null);
  useProperty(ref, 'checked', checked);
  useListener(ref, 'change', onChange && ((e) => onChange(e.currentTarget.checked)));

  return <s-switch ref={ref} label={label} details={details} />;
}

export function NumberField({ label, value, onInput, details, error, placeholder, min = 1, max = 100000 }) {
  const ref = useRef(null);
  useProperty(ref, 'value', value);
  useListener(ref, 'input', onInput && ((e) => onInput(e.currentTarget.value)));

  return (
    <s-number-field
      ref={ref}
      label={label}
      min={min}
      max={max}
      step="1"
      placeholder={placeholder}
      details={details}
      error={error || undefined}
    />
  );
}

export function TextField({ label, value, onInput, details, error, placeholder }) {
  const ref = useRef(null);
  useProperty(ref, 'value', value);
  useListener(ref, 'input', onInput && ((e) => onInput(e.currentTarget.value)));

  return <s-text-field ref={ref} label={label} placeholder={placeholder} details={details} error={error || undefined} />;
}
