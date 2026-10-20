// Places autocomplete session tokens: the admin field makes one per typing
// session (crypto.randomUUID) and sends it with each keystroke and the final
// Details call, which Google then bills as one session.
export function isPlacesSessionToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(value)
}
