export const BETTER_AUTH_TOKEN_COOKIE = 'betterAuthToken' as const

type RequestWithCookies = {
  cookies?: Record<string, string | string[] | undefined>
}

export function getBetterAuthTokenFromRequest(request: RequestWithCookies): string | null {
  const cookieValue = request.cookies?.[BETTER_AUTH_TOKEN_COOKIE]

  if (Array.isArray(cookieValue)) {
    const token = cookieValue[0]?.trim()

    return token && token.length > 0 ? token : null
  }

  if (typeof cookieValue === 'string') {
    const token = cookieValue.trim()

    return token.length > 0 ? token : null
  }

  return null
}