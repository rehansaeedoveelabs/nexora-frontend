import { API_BASE_URL } from '../config.js';

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }

  /** Laravel validation errors as { field: 'first message' }. */
  get fieldErrors() {
    const errors = this.body?.errors ?? {};
    return Object.fromEntries(Object.entries(errors).map(([field, messages]) => [field, [].concat(messages)[0]]));
  }
}

/**
 * The only way pages talk to the backend. Attaches a fresh App Bridge session token
 * to every request and retries once when the backend asks for a new one.
 */
async function request(method, path, body, retried = false) {
  const token = await window.shopify.idToken();

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Can’t reach Nexora. Check your connection and try again.', 0, null);
  }

  if (response.status === 401 && !retried && response.headers.get('X-Shopify-Retry-Invalid-Session-Request')) {
    return request(method, path, body, true);
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(data?.message ?? 'Something went wrong. Try again.', response.status, data);
  }

  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body = {}) => request('POST', path, body),
  patch: (path, body) => request('PATCH', path, body),
};

export function toast(message, isError = false) {
  window.shopify?.toast?.show(message, { isError, duration: isError ? 6000 : 3000 });
}
