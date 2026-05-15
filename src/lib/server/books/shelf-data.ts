import type { BookmarkRecord } from '@/types/cms';
import { getBookmarks } from '@/lib/payload/books/bookmarks';

export interface BooksShelfData {
  visibleBookBookmarks: BookmarkRecord[];
  visibleChapterBookmarks: BookmarkRecord[];
}

export async function getBooksShelfData(authToken: string): Promise<BooksShelfData> {
  try {
    const result = await getBookmarks({
      authToken,
      limit: 100,
    });

    return {
      visibleBookBookmarks: result.docs.filter(
        (bookmark) => bookmark.contentType === 'book' && bookmark.book != null
      ),
      visibleChapterBookmarks: result.docs.filter(
        (bookmark) => bookmark.contentType === 'chapter' && bookmark.chapter != null
      ),
    };
  } catch {
    return {
      visibleBookBookmarks: [],
      visibleChapterBookmarks: [],
    };
  }
}
