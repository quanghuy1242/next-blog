import type { Book, BookmarkRecord, Chapter } from '@/types/cms';
import { List } from 'lucide-react';
import { buildBookHref } from '@/lib/domain/books/routes';
import { BookmarkButton } from '@/components/shared/bookmark-button';
import { Button } from '@/components/ui/aria/button';
import { TextLink } from '@/components/ui/aria/link';

interface ChapterReaderHeaderProps {
  book: Book;
  chapter: Chapter;
  isAuthenticated: boolean;
  shouldRenderChapterTitle: boolean;
  viewerBookmark: BookmarkRecord | null;
  viewerStateLoaded: boolean;
  onOpenToc: () => void;
}

export function ChapterReaderHeader({
  book,
  chapter,
  isAuthenticated,
  shouldRenderChapterTitle,
  viewerBookmark,
  viewerStateLoaded,
  onOpenToc,
}: ChapterReaderHeaderProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-gray-500 sm:text-sm">
            <li>
              <TextLink href="/books" medium>
                Books
              </TextLink>
            </li>
            <li aria-hidden="true" className="text-gray-400">
              &gt;
            </li>
            <li className="min-w-0">
              <TextLink
                href={buildBookHref(book.id, book.slug)}
                className="break-words"
                medium
                prefetch={false}
              >
                {book.title}
              </TextLink>
            </li>
            <li aria-hidden="true" className="text-gray-400">
              &gt;
            </li>
            <li className="min-w-0 break-words text-gray-500">{chapter.title}</li>
          </ol>
        </nav>
        {shouldRenderChapterTitle ? (
          <h1 className="text-3xl font-bold leading-tight">{chapter.title}</h1>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2 self-start">
        <Button
          type="button"
          onPress={onOpenToc}
          variant="secondary"
          className="gap-2 px-3 lg:hidden"
        >
          <List aria-hidden className="h-4 w-4 text-base-content/60" />
          <span>Table of contents</span>
        </Button>
        <BookmarkButton
          contentType="chapter"
          contentId={chapter.id}
          isAuthenticated={isAuthenticated}
          initialBookmark={viewerBookmark}
          initialStateLoaded={viewerStateLoaded}
        />
      </div>
    </div>
  );
}
