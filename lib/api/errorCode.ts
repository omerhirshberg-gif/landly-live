// A stable code for every failure the member-facing routes answer, next to the
// English message kept for logs and API clients. The screens never print the
// message: they look the code up in their own language (lib/api/apiError.ts),
// so a Russian member at checkout or a Hebrew merchant in the dashboard reads
// the failure in their language, whatever the server's wording.

export const API_ERROR_CODES = ['invalid_request', 'sign_in_required', 'forbidden', 'not_found', 'conflict', 'rate_limited', 'unavailable'] as const
export type ApiErrorCode = (typeof API_ERROR_CODES)[number]

/** The code for an HTTP status: 400 invalid_request, 401 sign_in_required, 403 forbidden, 404 not_found, 409 conflict, 429 rate_limited, anything else unavailable. */
export function apiErrorCode(status: number): ApiErrorCode {
  switch (status) {
    case 400:
    case 422:
      return 'invalid_request'
    case 401:
      return 'sign_in_required'
    case 403:
      return 'forbidden'
    case 404:
      return 'not_found'
    case 409:
      return 'conflict'
    case 429:
      return 'rate_limited'
    default:
      return 'unavailable'
  }
}

/** The JSON body of a failed response: the message for logs, and the code for the screen. */
export function errorBody(message: string, status: number): { error: string; code: ApiErrorCode } {
  return { error: message, code: apiErrorCode(status) }
}

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && (API_ERROR_CODES as readonly string[]).includes(value)
}
