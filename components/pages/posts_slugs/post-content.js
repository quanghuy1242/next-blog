import { Tags } from 'components/shared/tags';

export function PostContent({ content, tags }) {
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
            link: { as: '/', href: '/' },
          }))}
        />
      )}
    </div>
  );
}
