export const BETTER_AUTH_TOKEN_COOKIE = 'better-auth.session_token' as const
export const PAYLOAD_BETTER_AUTH_TOKEN_COOKIE = 'betterAuthToken' as const
export const PAYLOAD_ADMIN_TOKEN_COOKIE = 'payload-token' as const

const TOKEN_SCHEME_PREFIXES = ['bearer ', 'jwt '] as const
const AUTH_TOKEN_COOKIE_CANDIDATES = [
  BETTER_AUTH_TOKEN_COOKIE,
  PAYLOAD_BETTER_AUTH_TOKEN_COOKIE,
  PAYLOAD_ADMIN_TOKEN_COOKIE,
] as const

type RequestWithAuth = {
  cookies?: Record<string, string | string[] | undefined>
  headers?: {
    authorization?: string | string[] | undefined
  }
}

function normalizeTokenValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    const token = value[0]?.trim()

    return token && token.length > 0 ? token : null
  }

  if (typeof value === 'string') {
    const token = value.trim()

    return token.length > 0 ? token : null
  }

  return null
}

function getTokenFromAuthorizationHeader(request: RequestWithAuth): string | null {
  const headerValue = normalizeTokenValue(request.headers?.authorization)

  if (!headerValue) {
    return null
  }

  const normalizedHeader = headerValue.trim()
  const lowerHeader = normalizedHeader.toLowerCase()

  for (const prefix of TOKEN_SCHEME_PREFIXES) {
    if (lowerHeader.startsWith(prefix)) {
      const token = normalizedHeader.slice(prefix.length).trim()

      return token.length > 0 ? token : null
    }
  }

  return normalizedHeader
}

function getTokenFromCookies(request: RequestWithAuth): string | null {
  for (const cookieName of AUTH_TOKEN_COOKIE_CANDIDATES) {
    const token = normalizeTokenValue(request.cookies?.[cookieName])

    if (token) {
      return token
    }
  }

  return null
}

export function getBetterAuthTokenFromRequest(request: RequestWithAuth): string | null {
  const authorizationHeaderToken = getTokenFromAuthorizationHeader(request)

  if (authorizationHeaderToken) {
    return authorizationHeaderToken
  }

  return getTokenFromCookies(request)
}