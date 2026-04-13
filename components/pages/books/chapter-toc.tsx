import React from 'react';
import Link from 'next/link';
import cn from 'classnames';
import type { Chapter } from 'types/cms';

interface ChapterTocProps {
  chapters: Chapter[];
  bookSlug: string;
  currentChapterSlug: string;
  onNavigate?: () => void;
}

export function ChapterToc({
  chapters,
  bookSlug,
  currentChapterSlug,
  onNavigate,
}: ChapterTocProps) {
  return (
    <nav aria-label="Chapter table of contents" className="rounded border border-gray-200">
      <div className="border-b border-gray-200 px-3 py-2 text-sm font-semibold text-gray-900">
        Chapters
      </div>
      <ol className="max-h-[70vh] overflow-y-auto">
        {chapters.map((chapter) => (
          <li key={`${chapter.slug}-${chapter.order}`}>
            <Link
              href={`/books/${bookSlug}/chapters/${chapter.slug}`}
              onClick={onNavigate}
              className={cn(
                'block border-b border-gray-100 px-3 py-2 text-sm',
                chapter.slug === currentChapterSlug
                  ? 'bg-blue text-white'
                  : 'text-gray-700 hover:bg-gray-50'
              )}
            >
              <span className="mr-2 text-xs opacity-80">{chapter.order}.</span>
              {chapter.title}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
