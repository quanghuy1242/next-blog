export const BETTER_AUTH_TOKEN_COOKIE = 'better-auth.session_token' as const
export const PAYLOAD_BETTER_AUTH_TOKEN_COOKIE = 'betterAuthToken' as const
export const PAYLOAD_ADMIN_TOKEN_COOKIE = 'payload-token' as const

const TOKEN_SCHEME_PREFIXES = ['bearer ', 'jwt '] as const
const AUTH_TOKEN_COOKIE_CANDIDATES = [
  PAYLOAD_BETTER_AUTH_TOKEN_COOKIE,
  PAYLOAD_ADMIN_TOKEN_COOKIE,
  BETTER_AUTH_TOKEN_COOKIE,
] as const

type RequestWithAuth = {
  cookies?: Record<string, string | string[] | undefined>
  headers?: {
    authorization?: string | string[] | undefined
  }
}

interface UnverifiedJwtPayload {
  sub?: unknown
  exp?: unknown
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

/**
 * Extracts a cache partition from an unverified JWT.
 *
 * Only use this for cache keys. Never use unverified claims for authorization.
 */
export function getAuthCacheSubjectFromToken(
  token: string | null | undefined
): string | null {
  if (!token) {
    return null
  }

  const payload = parseUnverifiedJwtPayload(token)

  if (!payload) {
    return null
  }

  const subject = normalizeClaimString(payload.sub)
  const expiresAt = normalizeClaimNumber(payload.exp)

  if (!subject || expiresAt === null) {
    return null
  }

  if (expiresAt <= Math.floor(Date.now() / 1000)) {
    return null
  }

  return subject
}

function parseUnverifiedJwtPayload(token: string): UnverifiedJwtPayload | null {
  const trimmedToken = token.trim()

  if (!trimmedToken) {
    return null
  }

  const tokenParts = trimmedToken.split('.')

  if (tokenParts.length !== 3) {
    return null
  }

  const payloadJson = decodeBase64Url(tokenParts[1])

  if (!payloadJson) {
    return null
  }

  try {
    const payload = JSON.parse(payloadJson) as UnverifiedJwtPayload

    if (!payload || typeof payload !== 'object') {
      return null
    }

    return payload
  } catch {
    return null
  }
}

function decodeBase64Url(value: string): string | null {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return null
  }

  const normalizedValue = trimmedValue.replace(/-/g, '+').replace(/_/g, '/')
  const paddingLength = (4 - (normalizedValue.length % 4)) % 4
  const paddedValue = `${normalizedValue}${'='.repeat(paddingLength)}`

  try {
    return Buffer.from(paddedValue, 'base64').toString('utf8')
  } catch {
    return null
  }
}

function normalizeClaimString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmedValue = value.trim()

  return trimmedValue.length > 0 ? trimmedValue : null
}

function normalizeClaimNumber(value: unknown): number | null {
  const parsedValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.trim())
        : Number.NaN

  if (!Number.isFinite(parsedValue)) {
    return null
  }

  return Math.floor(parsedValue)
}
