export function buildBookRouteSegment(bookId: number | string, bookSlug: string): string {
  const normalizedBookId = String(bookId).trim()
  const normalizedBookSlug = bookSlug.trim()

  if (!normalizedBookId || !normalizedBookSlug) {
    return ''
  }

  return `${normalizedBookId}~${normalizedBookSlug}`
}

export function buildBookHref(bookId: number | string, bookSlug: string): string {
  const routeSegment = buildBookRouteSegment(bookId, bookSlug)

  return routeSegment ? `/books/${routeSegment}` : ''
}

export function buildChapterHref(
  bookId: number | string,
  bookSlug: string,
  chapterSlug: string,
  fragment = ''
): string {
  const normalizedBookRouteSegment = buildBookRouteSegment(bookId, bookSlug)
  const normalizedChapterSlug = chapterSlug.trim()
  const normalizedFragment = fragment.trim()

  if (!normalizedBookRouteSegment || !normalizedChapterSlug) {
    return ''
  }

  const baseHref = `/books/${normalizedBookRouteSegment}/chapters/${normalizedChapterSlug}`

  return normalizedFragment ? `${baseHref}#${normalizedFragment}` : baseHref
}

export interface ParsedBookRouteSegment {
  bookId: number | null
  bookSlug: string
  isLegacySlugOnly: boolean
}

export function parseBookRouteSegment(segment: string): ParsedBookRouteSegment {
  const normalizedSegment = segment.trim()

  if (!normalizedSegment) {
    return {
      bookId: null,
      bookSlug: '',
      isLegacySlugOnly: false,
    }
  }

  const separatorIndex = normalizedSegment.indexOf('~')

  if (separatorIndex < 0) {
    return {
      bookId: null,
      bookSlug: normalizedSegment,
      isLegacySlugOnly: true,
    }
  }

  const bookIdPart = normalizedSegment.slice(0, separatorIndex).trim()
  const bookSlug = normalizedSegment.slice(separatorIndex + 1).trim()
  const parsedBookId = Number(bookIdPart)

  if (!bookIdPart || !bookSlug || !Number.isInteger(parsedBookId) || parsedBookId <= 0) {
    return {
      bookId: null,
      bookSlug: normalizedSegment,
      isLegacySlugOnly: true,
    }
  }

  return {
    bookId: parsedBookId,
    bookSlug,
    isLegacySlugOnly: false,
  }
}
