import { Tags } from 'components/shared/tags';

interface PostContentProps {
  content: string;
  tags?: string[];
}

export function PostContent({
  content,
  tags = [],
}: PostContentProps) {
  return (
    <div className="max-w-3xl mx-auto">
      <div
        className="prose prose-directive mb-4"
        dangerouslySetInnerHTML={{ __html: content }}
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
