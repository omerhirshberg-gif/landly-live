// The pure half of scripts/check-apple-oauth.mjs, kept free of network and
// file access so tests/unit/checkAppleOAuth.test.ts can feed it recorded
// responses.

/** The Services ID each Firebase project's Apple provider must send. */
export const EXPECTED_APPLE_CLIENT_IDS = {
  'landly-dev': 'com.amitbd.landlyapp.web.dev',
  'landly-be752': 'com.amitbd.landlyapp.web',
}

/** client_id and redirect_uri from the Apple authorize URL Firebase built. */
export function parseAuthUri(authUri) {
  const url = new URL(authUri)
  return {
    origin: url.origin,
    clientId: url.searchParams.get('client_id'),
    redirectUri: url.searchParams.get('redirect_uri'),
  }
}

/**
 * What Apple's authorize page says about a request:
 *   bad-redirect -- the redirect_uri isn't a Return URL of the Services ID
 *   bad-client   -- Apple doesn't know the Services ID
 *   accepted     -- Apple would show its sign-in page
 */
export function classifyAppleAuthorize(status, body) {
  const text = String(body ?? '')
  if (/Invalid web redirect url/i.test(text) || /"errorCode"\s*:\s*"invalid_request"/.test(text)) return 'bad-redirect'
  if (/invalid_client/.test(text)) return 'bad-client'
  if (status >= 400) return 'error'
  return 'accepted'
}

/**
 * What Apple's token endpoint said when Firebase redeemed a made-up code
 * (accounts:signInWithIdp's error message):
 *   key-ok    -- invalid_grant: Apple accepted the client secret Firebase
 *                signs with the project's Team ID, Key ID and private key,
 *                and only refused the code
 *   bad-key   -- invalid_client: that Apple configuration in Firebase is wrong
 *   unknown   -- anything else (shown as is)
 */
export function classifyTokenExchange(message) {
  const error = String(message ?? '').match(/[{\s,&]error=([^&,}\s]+)/)?.[1]
  if (error === 'invalid_grant') return 'key-ok'
  if (error === 'invalid_client') return 'bad-key'
  return 'unknown'
}

/** One row of the report; ok only when Apple accepts, the client is the expected one and the key works. */
export function assessRow({ projectId, host, authUri, status, body, exchangeMessage }) {
  const { origin, clientId, redirectUri } = parseAuthUri(authUri)
  const expectedClientId = EXPECTED_APPLE_CLIENT_IDS[projectId] ?? null
  const apple = origin === 'https://appleid.apple.com' ? classifyAppleAuthorize(status, body) : 'not-apple'
  const exchange = classifyTokenExchange(exchangeMessage)
  const clientOk = expectedClientId !== null && clientId === expectedClientId
  return { projectId, host, clientId, expectedClientId, redirectUri, apple, exchange, ok: clientOk && apple === 'accepted' && exchange === 'key-ok' }
}
