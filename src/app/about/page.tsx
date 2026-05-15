import { getAboutPageData } from '@/lib/server/about/page-data';
import { getCoverImageUrl } from '@/lib/utils/image';
import { buildMetadata } from '@/lib/utils/next-metadata';
import { Container } from '@/components/core/container';
import { Layout } from '@/components/core/layout';
import { LexicalRenderer } from '@/components/shared/lexical-renderer';

export const revalidate = 3600;

export async function generateMetadata() {
  const data = await getAboutPageData();

  return buildMetadata({
    title: `About ${data.author?.fullName || 'Author'}`,
    description: `Learn more about ${data.author?.fullName || 'the author'}`,
    image: data.author?.avatar ? getCoverImageUrl(data.author.avatar) : null,
  });
}

export default async function AboutPage() {
  const data = await getAboutPageData();

  return (
    <Layout className="flex flex-col items-center">
      <Container className="my-4 flex flex-col items-center px-4 md:px-20">
        <h1 className="mb-6 text-4xl font-bold">{data.author?.fullName}</h1>
        <div className="w-full max-w-4xl">
          <LexicalRenderer
            data={data.author?.bio}
            className="max-w-none"
            fallback={<div className="italic text-gray-500">No bio available.</div>}
          />
        </div>
      </Container>
    </Layout>
  );
}
