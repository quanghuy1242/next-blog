import React from 'react';
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical';
import { LexicalRenderer } from 'components/shared/lexical-renderer';

interface ChapterContentProps {
  content: SerializedEditorState | null | undefined;
}

export function ChapterContent({ content }: ChapterContentProps) {
  return (
    <div className="max-w-3xl mx-auto w-full">
      <LexicalRenderer
        data={content}
        className="max-w-none"
        fallback={<div className="text-gray-500 italic">No content available.</div>}
      />
    </div>
  );
}
