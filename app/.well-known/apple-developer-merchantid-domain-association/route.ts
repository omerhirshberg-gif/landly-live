// Apple Pay on the web (Tranzila Hosted Fields) needs Tranzila's domain-verification file served at exactly this path, with
// no extension, over HTTPS (docs.tranzila.com apple-pay-iframe, step 1). Its content comes from the environment of each
// deployment, so nothing third-party is committed and no code change is needed once Tranzila provides it. Served as
// application/octet-stream, as Tranzila's guide recommends for this extensionless file. Unset, the path is a 404.
export const dynamic = 'force-dynamic'

export function GET() {
  const content = process.env.TRANZILA_APPLE_PAY_DOMAIN_ASSOCIATION?.trim()
  if (!content || content.length > 65536) return new Response('Not found', { status: 404 })
  return new Response(content, { status: 200, headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'public, max-age=300' } })
}
