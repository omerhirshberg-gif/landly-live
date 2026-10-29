// A short, human name for the device a session runs on, for the Sessions
// card in Privacy & Security: the model on a phone ("iPhone 15 Pro",
// "Galaxy S24"), the device and browser on the web ("Mac · Chrome",
// "Windows PC · Edge", "iPhone · Safari"). Pure and shared with the Expo app.

export const MAX_DEVICE_NAME = 80

const clean = (value: string) => value.replace(/\s+/g, ' ').trim().slice(0, MAX_DEVICE_NAME)

export interface NativeDeviceInfo {
  /** iOS: the marketing model ("iPhone 15 Pro"); Android: the build model, often a code ("SM-S921B"). */
  modelName?: string | null
  /** Android: the name in Settings › About ("Galaxy S24"); iOS 16+ only ever says "iPhone". */
  deviceName?: string | null
  manufacturer?: string | null
  osName?: string | null
}

/**
 * From expo-device: on iOS the model; on Android the device's own name, else
 * maker and model ("Samsung SM-S921B"). Falls back to the OS (never to an
 * Android build fingerprint), then to the platform.
 */
export function nativeDeviceName(info: NativeDeviceInfo, platform: 'ios' | 'android'): string {
  const model = clean(info.modelName ?? '')
  if (platform === 'ios' && model) return model
  if (platform === 'android') {
    const named = clean(info.deviceName ?? '')
    if (named) return named
    const maker = clean(info.manufacturer ?? '')
    const brand = maker && !model.toLowerCase().startsWith(maker.toLowerCase()) ? maker.charAt(0).toUpperCase() + maker.slice(1) : ''
    if (model) return clean([brand, model].filter(Boolean).join(' '))
  }
  const os = clean(info.osName ?? '')
  return (os && !os.includes('/') ? os : '') || (platform === 'ios' ? 'iPhone' : 'Android')
}

/**
 * "Device · Browser" from a browser's user agent. iPadOS reports a Mac user
 * agent, so `touchPoints` (navigator.maxTouchPoints) tells an iPad from a Mac.
 */
export function describeUserAgent(ua: string, touchPoints = 0): string {
  const device = deviceOf(ua, touchPoints)
  const browser = browserOf(ua)
  return clean(browser ? `${device} · ${browser}` : device)
}

function deviceOf(ua: string, touchPoints: number): string {
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)) return 'iPad'
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPod/.test(ua)) return 'iPod'
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Android phone' : 'Android tablet'
  if (/CrOS/.test(ua)) return 'Chromebook'
  if (/Windows/.test(ua)) return 'Windows PC'
  if (/Macintosh|Mac OS X/.test(ua)) return 'Mac'
  if (/Linux/.test(ua)) return 'Linux'
  return 'Browser'
}

function browserOf(ua: string): string {
  if (/Edg(?:e|A|iOS)?\//.test(ua)) return 'Edge'
  if (/OPR\/|Opera/.test(ua)) return 'Opera'
  if (/SamsungBrowser\//.test(ua)) return 'Samsung Internet'
  if (/FxiOS\/|Firefox\//.test(ua)) return 'Firefox'
  if (/CriOS\/|Chrome\//.test(ua)) return 'Chrome'
  if (/Safari\//.test(ua)) return 'Safari'
  return ''
}
