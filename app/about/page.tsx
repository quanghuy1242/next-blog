import { getDataForAbout } from 'common/apis/author';
import { Container } from 'components/core/container';
import { LexicalRenderer } from 'components/shared/lexical-renderer';
import { generateMetaTags } from 'common/utils/meta-tags';
import { getCoverImageUrl } from 'common/utils/image';
import type { Metadata } from 'next';

export const revalidate = 3600; // Revalidate every hour

export default async function Page() {
  const data = await getDataForAbout();
  const author = data.author;

  return (
    <main className="flex flex-col items-center">
      <div className="mt-16" />
      <Container className="flex flex-col items-center md:px-20 my-4 px-4">
        <h1 className="text-4xl font-bold mb-6">{author?.fullName}</h1>
        <div className="w-full max-w-4xl">
          <LexicalRenderer
            data={author?.bio}
            className="prose prose-lg max-w-none"
            fallback={
              <div className="text-gray-500 italic">No bio available.</div>
            }
          />
        </div>
      </Container>
    </main>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const data = await getDataForAbout();
  const author = data.author;

  const metaImageUrl = author?.avatar ? getCoverImageUrl(author.avatar) : '';
  const metaTags = generateMetaTags({
    title: `About ${author?.fullName || 'Author'}`,
    description: `Learn more about ${author?.fullName || 'the author'}`,
    image: metaImageUrl,
  });

  const metadata: Metadata = {
    title: metaTags.find((tag) => tag.tag === 'title')?.content || 'About',
  };

  const description = metaTags.find(
    (tag) => tag.tag === 'meta' && tag.attributes?.name === 'description'
  )?.attributes?.content;
  if (description) {
    metadata.description = description;
  }

  return metadata;
}
