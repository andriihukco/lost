// When a stored session may be dropped. Only the server refusing it (401/403) drops it. A failed check
// (offline, flaky signal) keeps the identity, so the player keeps their progress and can still open the map.
export function shouldDropSession(error: { status?: number } | null): boolean {
  return error?.status === 401 || error?.status === 403;
}
