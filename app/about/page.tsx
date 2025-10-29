import { getDataForAbout } from 'common/apis/author';
import { Container } from 'components/core/container';
import { LexicalRenderer } from 'components/shared/lexical-renderer';
import type { Metadata } from 'next';
import { getCoverImageUrl } from 'common/utils/image';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const { author } = await getDataForAbout();

  return (
    <div className="flex flex-col items-center">
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
    </div>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const { author } = await getDataForAbout();
  const title = `About ${author?.fullName || 'Author'}`;
  const description = `Learn more about ${author?.fullName || 'the author'}`;
  const image = author?.avatar ? getCoverImageUrl(author.avatar) : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: image ? [{ url: image }] : undefined,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}
