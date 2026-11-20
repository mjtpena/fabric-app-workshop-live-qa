/** A user-safe error description: a category chip plus a message. */
export interface AppErrorInfo {
  category: string;
  message: string;
}

/**
 * Turn anything thrown by the store, the Rayfin SDK or a connector into a category and a message.
 * Categories: validation, permission, not_found, auth, capacity, network, timeout, connector, unknown.
 */
export function describeError(err: unknown): AppErrorInfo {
  if (err && typeof err === 'object') {
    const e = err as { category?: unknown; message?: unknown; name?: unknown; code?: unknown; status?: unknown };
    const message = typeof e.message === 'string' && e.message ? e.message : 'Something went wrong.';
    if (typeof e.category === 'string') return { category: e.category, message };
    const code = String(e.code ?? '');
    const status = typeof e.status === 'number' ? e.status : undefined;
    if (e.name === 'AbortError' || code === 'TIMEOUT') return { category: 'timeout', message };
    if (status === 429 || /CapacityLimitExceeded|TooManyRequests/i.test(code + message))
      return {
        category: 'capacity',
        message: 'The Fabric capacity behind this app is over its limit right now. Wait a minute and try again.',
      };
    if (status === 401 || /UNAUTH|INVALID_GRANT|NOT_AUTHENTICATED/i.test(code)) return { category: 'auth', message };
    if (status === 403 || /FORBIDDEN|ACCESS_DENIED|AuthorizationCheckFailed/i.test(code + message))
      return { category: 'permission', message };
    if (status === 404) return { category: 'not_found', message };
    if (e.name === 'NetworkError' || e.name === 'TypeError' || /network|fetch/i.test(message))
      return { category: 'network', message };
    return { category: 'unknown', message };
  }
  return { category: 'unknown', message: typeof err === 'string' ? err : 'Something went wrong.' };
}
