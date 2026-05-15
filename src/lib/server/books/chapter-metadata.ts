import type { Book, Chapter } from '@/types/cms';
import { getCoverImageUrl } from '@/lib/shared/image';
import { buildMetadata } from '@/lib/shared/metadata';

export function getChapterPageMetadata(book: Book, chapter: Chapter) {
  return buildMetadata({
    title: `${chapter.title} | ${book.title}`,
    description: `Read ${chapter.title} from ${book.title}.`,
    image: book.cover ? getCoverImageUrl(book.cover) : null,
    type: 'article',
  });
}
