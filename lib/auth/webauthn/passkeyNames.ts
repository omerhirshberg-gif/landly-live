// A passkey's label in Settings, worked out when it's created: the password
// manager that holds it when its AAGUID is a well-known one (the ones that
// sync, which is most passkeys), otherwise the browser and OS it was made on.
// Pure, so the website and tests share it.

// From the passkey-authenticator-aaguids community list.
const KNOWN_AAGUIDS: Record<string, string> = {
  'fbfc3007-154e-4ecc-8c0b-6e020557d7bd': 'iCloud Keychain',
  'dd4ec289-e01d-41c9-bb89-70fa845d4bf2': 'iCloud Keychain',
  'ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4': 'Google Password Manager',
  'adce0002-35bc-c60a-648b-0b25f1f05503': 'Chrome on Mac',
  '08987058-cadc-4b81-b6e1-30de50dcbe96': 'Windows Hello',
  '9ddd1817-af5a-4672-a2b9-3e3dd95000a9': 'Windows Hello',
  '6028b017-b1d4-4c02-b4b3-afcdafc96bb2': 'Windows Hello',
  'bada5566-a7aa-401f-bd96-45619a55120d': '1Password',
  'd548826e-79b4-db40-a3d8-11116f7e8349': 'Bitwarden',
  '531126d6-e717-415c-9320-3d9aa6981239': 'Dashlane',
  '53414d53-554e-4700-0000-000000000000': 'Samsung Pass',
}

function browserName(ua: string): string | null {
  if (/Edg\//.test(ua)) return 'Edge'
  if (/SamsungBrowser\//.test(ua)) return 'Samsung Internet'
  if (/Firefox\/|FxiOS\//.test(ua)) return 'Firefox'
  if (/Chrome\/|CriOS\//.test(ua)) return 'Chrome'
  if (/Safari\//.test(ua)) return 'Safari'
  return null
}

function osName(ua: string): string | null {
  if (/iPhone|iPod/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Mac OS X|Macintosh/.test(ua)) return 'macOS'
  if (/Windows/.test(ua)) return 'Windows'
  if (/CrOS/.test(ua)) return 'ChromeOS'
  if (/Linux/.test(ua)) return 'Linux'
  return null
}

export function passkeyName(aaguid: string | null | undefined, userAgent: string | null | undefined): string {
  const known = aaguid ? KNOWN_AAGUIDS[aaguid.toLowerCase()] : undefined
  if (known) return known
  const ua = userAgent ?? ''
  const browser = browserName(ua)
  const os = osName(ua)
  if (browser && os) return `${browser} · ${os}`
  return browser ?? os ?? 'Passkey'
}
