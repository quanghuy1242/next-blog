import type { Book, Chapter } from '@/types/cms';
import { ChapterToc } from '@/components/pages/books/chapter-toc';
import { ChapterTocDrawer } from '@/components/pages/books/chapter-toc-drawer';

interface ChapterReaderTocProps {
  book: Book;
  chapter: Chapter;
  chapters: Chapter[];
  readingProgressByChapterId: Record<number, number>;
}

interface ChapterReaderTocDrawerProps extends ChapterReaderTocProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChapterReaderTocSidebar({
  book,
  chapter,
  chapters,
  readingProgressByChapterId,
}: ChapterReaderTocProps) {
  return (
    <aside
      className="hidden lg:sticky lg:top-20 lg:col-span-3 lg:block lg:self-start lg:overflow-y-auto xl:col-span-2"
      style={{ maxHeight: 'calc(100vh - 6rem)' }}
    >
      <p className="mb-3 text-sm font-semibold text-gray-900">Chapters</p>
      <ChapterToc
        chapters={chapters}
        bookId={book.id}
        bookSlug={book.slug}
        currentChapterSlug={chapter.slug}
        readingProgressByChapterId={readingProgressByChapterId}
      />
    </aside>
  );
}

export function ChapterReaderTocDrawer({
  book,
  chapter,
  chapters,
  isOpen,
  onClose,
  readingProgressByChapterId,
}: ChapterReaderTocDrawerProps) {
  return (
    <ChapterTocDrawer isOpen={isOpen} onClose={onClose}>
      <ChapterToc
        chapters={chapters}
        bookId={book.id}
        bookSlug={book.slug}
        currentChapterSlug={chapter.slug}
        onNavigate={onClose}
        readingProgressByChapterId={readingProgressByChapterId}
      />
    </ChapterTocDrawer>
  );
}
