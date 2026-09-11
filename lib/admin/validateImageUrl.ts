// Offer images are pasted links to externally-hosted files (Drive, Imgur, etc.)
// rather than an upload — this is just a sanity check that it's a fetchable
// http(s) link, not a guarantee the image actually loads (the customer-facing
// <img> has its own onError fallback for that).
export function isValidImageUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
