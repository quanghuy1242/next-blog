import { Tags } from 'components/shared/tags';
import { LexicalRenderer } from 'components/shared/lexical-renderer';
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical';

interface PostContentProps {
  content: SerializedEditorState | null | undefined;
  tags?: string[];
}

export function PostContent({ content, tags = [] }: PostContentProps) {
  return (
    <div className="max-w-3xl mx-auto">
      {/* Phase 9: Lexical rich text rendering */}
      <LexicalRenderer
        data={content}
        className="max-w-none mb-8"
        fallback={
          <div className="text-gray-500 italic mb-8">No content available.</div>
        }
      />
      {!!tags.length && (
        <Tags
          items={tags.map((tag) => ({
            name: tag,
            href: { pathname: '/', query: { tag } },
          }))}
        />
      )}
    </div>
  );
}
