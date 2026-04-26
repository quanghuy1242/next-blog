import { buildChapterHref } from 'common/utils/book-route'

export interface ChapterLinkTarget {
  slug: string
  chapterSourceKey?: string | null
}

export type ResolvedEpubInternalLink =
  | {
      kind: 'anchor'
      href: `#${string}`
      fragment: string
    }
  | {
      kind: 'chapter'
      href: string
      fragment: string
    }
  | {
      kind: 'unresolved'
    }

export function splitEpubHref(epubHref: string): { pathPart: string; fragment: string } {
  const trimmedHref = epubHref.trim()

  if (!trimmedHref) {
    return { pathPart: '', fragment: '' }
  }

  const hashIndex = trimmedHref.indexOf('#')

  if (hashIndex < 0) {
    return { pathPart: trimmedHref, fragment: '' }
  }

  return {
    pathPart: trimmedHref.slice(0, hashIndex),
    fragment: trimmedHref.slice(hashIndex + 1),
  }
}

export function normalizeEpubPath(path: string): string {
  const trimmedPath = path.trim()

  if (!trimmedPath) {
    return ''
  }

  let decodedPath = trimmedPath

  try {
    decodedPath = decodeURIComponent(trimmedPath)
  } catch {
    decodedPath = trimmedPath
  }

  const withoutQuery = decodedPath.split('?')[0] ?? ''
  const normalizedSegments: string[] = []

  for (const segment of withoutQuery.replace(/\\/g, '/').split('/')) {
    if (!segment || segment === '.') {
      continue
    }

    if (segment === '..') {
      normalizedSegments.pop()
      continue
    }

    normalizedSegments.push(segment)
  }

  return normalizedSegments.join('/').toLowerCase()
}

export function chapterSourceKeyToSpineHref(chapterSourceKey: string): string | null {
  const trimmedKey = chapterSourceKey.trim()

  if (!trimmedKey) {
    return null
  }

  const parts = trimmedKey.split('::')
  const spineHref = parts[1]?.trim()

  return spineHref ? spineHref : null
}

function getPathBasename(path: string): string {
  const normalizedPath = normalizeEpubPath(path)

  if (!normalizedPath) {
    return ''
  }

  return normalizedPath.split('/').pop() ?? normalizedPath
}

function isExactPathMatch(inputPath: string, candidatePath: string): boolean {
  const normalizedInput = normalizeEpubPath(inputPath)
  const normalizedCandidate = normalizeEpubPath(candidatePath)

  return Boolean(normalizedInput && normalizedCandidate && normalizedInput === normalizedCandidate)
}

function isSuffixPathMatch(inputPath: string, candidatePath: string): boolean {
  const normalizedInput = normalizeEpubPath(inputPath)
  const normalizedCandidate = normalizeEpubPath(candidatePath)

  if (!normalizedInput || !normalizedCandidate) {
    return false
  }

  return (
    normalizedInput.endsWith(`/${normalizedCandidate}`) ||
    normalizedCandidate.endsWith(`/${normalizedInput}`)
  )
}

function isBasenameMatch(inputPath: string, candidatePath: string): boolean {
  const normalizedInput = normalizeEpubPath(inputPath)
  const normalizedCandidate = normalizeEpubPath(candidatePath)

  if (!normalizedInput || !normalizedCandidate) {
    return false
  }

  return getPathBasename(normalizedInput) === getPathBasename(normalizedCandidate)
}

/**
 * Resolves a raw EPUB internal href to either a chapter link, an in-page anchor, or
 * an unresolved fallback.
 */
export function resolveEpubHref(
  epubHref: string,
  chapters: ChapterLinkTarget[],
  bookId: number | null,
  bookSlug: string,
): ResolvedEpubInternalLink {
  const { pathPart, fragment } = splitEpubHref(epubHref)
  const normalizedFragment = fragment.trim()

  if (!pathPart.trim()) {
    if (!normalizedFragment) {
      return { kind: 'unresolved' }
    }

    return {
      kind: 'anchor',
      href: `#${normalizedFragment}`,
      fragment: normalizedFragment,
    }
  }

  const normalizedBookSlug = bookSlug.trim()
  const normalizedBookId = Number.isInteger(bookId) && (bookId ?? 0) > 0 ? bookId : null

  if (!normalizedBookSlug || !normalizedBookId) {
    return { kind: 'unresolved' }
  }

  const exactMatches: ChapterLinkTarget[] = []
  const suffixMatches: ChapterLinkTarget[] = []
  const basenameMatches: ChapterLinkTarget[] = []

  for (const chapter of chapters) {
    const sourceHref = chapterSourceKeyToSpineHref(chapter.chapterSourceKey ?? '')

    if (!sourceHref) {
      continue
    }

    if (isExactPathMatch(pathPart, sourceHref)) {
      exactMatches.push(chapter)
      continue
    }

    if (isSuffixPathMatch(pathPart, sourceHref)) {
      suffixMatches.push(chapter)
      continue
    }

    if (isBasenameMatch(pathPart, sourceHref)) {
      basenameMatches.push(chapter)
    }
  }

  const resolvedChapter =
    exactMatches.length === 1
      ? exactMatches[0]
      : suffixMatches.length === 1
        ? suffixMatches[0]
        : basenameMatches.length === 1
          ? basenameMatches[0]
          : null

  if (!resolvedChapter) {
    return { kind: 'unresolved' }
  }

  const href = buildChapterHref(normalizedBookId, normalizedBookSlug, resolvedChapter.slug, normalizedFragment)

  if (!href) {
    return { kind: 'unresolved' }
  }

  return {
    kind: 'chapter',
    href,
    fragment: normalizedFragment,
  }
}
