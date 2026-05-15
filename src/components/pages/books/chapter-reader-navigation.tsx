import type { Chapter } from '@/types/cms';
import { buildChapterHref } from '@/lib/domain/books/routes';
import { TextLink } from '@/components/ui/aria/link';

interface ChapterReaderNavigationProps {
  bookId: number;
  bookSlug: string;
  previousChapter: Chapter | null;
  nextChapter: Chapter | null;
}

export function ChapterReaderNavigation({
  bookId,
  bookSlug,
  previousChapter,
  nextChapter,
}: ChapterReaderNavigationProps) {
  return (
    <div className="mt-8 flex items-center justify-between gap-4 border-t border-gray-200 pt-4 text-sm">
      <div>
        {previousChapter ? (
          <TextLink
            href={buildChapterHref(bookId, bookSlug, previousChapter.slug)}
            prefetch={false}
          >
            Previous: {previousChapter.title}
          </TextLink>
        ) : null}
      </div>
      <div className="text-right">
        {nextChapter ? (
          <TextLink
            href={buildChapterHref(bookId, bookSlug, nextChapter.slug)}
            prefetch={false}
          >
            Next: {nextChapter.title}
          </TextLink>
        ) : null}
      </div>
    </div>
  );
}
