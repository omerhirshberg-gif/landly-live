import { isApiErrorCode } from './errorCode'
import type { TranslationKey } from '@/lib/i18n/translations'

/**
 * A failed response, in the reader's language: the dictionary line for the
 * response's `code` (api_err_<code>), or `fallback` when the body has none (an
 * older server, a network error page). The server's English `error` text is
 * never shown.
 */
export function localizedApiError(data: unknown, t: (key: TranslationKey) => string, fallback: TranslationKey): string {
  const code = (data as { code?: unknown } | null | undefined)?.code
  return isApiErrorCode(code) ? t(`api_err_${code}` as TranslationKey) : t(fallback)
}
