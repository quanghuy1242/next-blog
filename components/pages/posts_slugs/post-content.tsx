import { Tags } from 'components/shared/tags';

interface PostContentProps {
  content: string;
  tags?: string[];
}

export function PostContent({ content, tags = [] }: PostContentProps) {
  return (
    <div className="max-w-3xl mx-auto">
      {/* Temporary: Display raw JSON (Phase 8) */}
      {/* TODO Phase 9: Replace with Lexical renderer */}
      <pre className="bg-gray-100 p-4 rounded overflow-x-auto text-sm mb-4">
        {content}
      </pre>
      {/* 
        Phase 9 will replace above with:
        <div className="prose prose-lg max-w-none mb-4">
          <LexicalRenderer content={JSON.parse(content)} />
        </div>
      */}
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
