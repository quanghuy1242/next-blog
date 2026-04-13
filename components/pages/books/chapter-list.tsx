import React from 'react';
import Link from 'next/link';
import type { Chapter } from 'types/cms';

interface ChapterListProps {
  chapters: Chapter[];
  bookSlug: string;
}

export function ChapterList({ chapters, bookSlug }: ChapterListProps) {
  if (!chapters.length) {
    return <p className="text-sm text-gray-500">No chapters are available yet.</p>;
  }

  return (
    <ol className="space-y-2">
      {chapters.map((chapter) => (
        <li key={`${chapter.slug}-${chapter.order}`}>
          <Link
            href={`/books/${bookSlug}/chapters/${chapter.slug}`}
            className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 hover:border-gray-300"
          >
            {/* <span className="mr-4 text-sm text-gray-600">Chapter {chapter.order}</span> */}
            <span className="flex-1 text-sm font-medium text-gray-900">
              {chapter.title}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
