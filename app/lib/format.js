export function plural(count, one, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

/** "fragile, Glass ,fragile" → ['fragile', 'Glass'] */
export function splitTags(text) {
  return [...new Set(String(text ?? '').split(',').map((t) => t.trim()).filter(Boolean))];
}
