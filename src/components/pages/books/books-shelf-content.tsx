import { BooksGrid } from '@/components/shared/books-grid';
import { Text } from '@/components/shared/text';
import { TextLink } from '@/components/shared/ui/text-link';
import { buildChapterHref } from '@/lib/domain/books/routes';
import type { Book, BookmarkRecord } from '@/types/cms';

interface BooksShelfContentProps {
  isAuthenticated: boolean;
  visibleBookBookmarks: BookmarkRecord[];
  visibleChapterBookmarks: BookmarkRecord[];
}

export function BooksShelfContent({
  isAuthenticated,
  visibleBookBookmarks,
  visibleChapterBookmarks,
}: BooksShelfContentProps) {
  const hasAny = visibleBookBookmarks.length > 0 || visibleChapterBookmarks.length > 0;

  return (
    <>
      <Text text="Bookshelf" />
      {!isAuthenticated ? (
        <p className="mt-4 text-gray-600">Please sign in to view your bookmarks.</p>
      ) : !hasAny ? (
        <p className="mt-4 text-gray-600">No bookmarks yet.</p>
      ) : (
        <div className="mt-4 space-y-8">
          {visibleBookBookmarks.length > 0 ? (
            <section>
              <BooksGrid
                books={(visibleBookBookmarks.map((bookmark) => bookmark.book).filter(Boolean) as Book[]).map(
                  (book) => ({
                    ...book,
                    isBookmarked: true,
                  })
                )}
                isAuthenticated
              />
            </section>
          ) : null}
          {visibleChapterBookmarks.length > 0 ? (
            <section>
              <Text text="Chapters" />
              <ul className="mt-3 space-y-2">
                {visibleChapterBookmarks.map((bookmark) => {
                  const chapter = bookmark.chapter;
                  const book = chapter?.book;

                  return chapter ? (
                    <li key={bookmark.id}>
                      {book ? (
                        <TextLink href={buildChapterHref(book.id, book.slug, chapter.slug)}>
                          {chapter.title} <span className="text-gray-500">in {book.title}</span>
                        </TextLink>
                      ) : (
                        <span>{chapter.title}</span>
                      )}
                    </li>
                  ) : null;
                })}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
