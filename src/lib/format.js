export function plural(count, one, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}
