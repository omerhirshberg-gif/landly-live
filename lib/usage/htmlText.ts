/** Escapes text for HTML: pure, so the email builder can be imported by tests and the client. */
export function escapeHtmlText(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}
