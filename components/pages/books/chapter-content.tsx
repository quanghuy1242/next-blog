import React from 'react';
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical';
import { LexicalRenderer } from 'components/shared/lexical-renderer';
import type { ChapterLinkTarget } from 'common/utils/epub-link-resolver';

interface ChapterContentProps {
  content: SerializedEditorState | null | undefined;
  bookId: number;
  bookSlug: string;
  chapters: ChapterLinkTarget[];
}

export function ChapterContent({ content, bookId, bookSlug, chapters }: ChapterContentProps) {
  return (
    <div className="max-w-3xl mx-auto w-full">
      <LexicalRenderer
        data={content}
        className="max-w-none"
        fallback={<div className="text-gray-500 italic">No content available.</div>}
        epubLinkContext={{
          bookId,
          bookSlug,
          chapters,
        }}
      />
    </div>
  );
}
