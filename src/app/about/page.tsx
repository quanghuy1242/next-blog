import { getAboutPageData } from '@/lib/server/about/page-data';
import { getCoverImageUrl } from '@/lib/shared/image';
import { buildMetadata } from '@/lib/shared/metadata';
import { PageSection } from '@/components/layout/page-section';
import { PageShell } from '@/components/layout/page-shell';
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
    <PageShell className="flex flex-col items-center">
      <PageSection width="wide" className="flex flex-col items-center px-4 md:px-20">
        <h1 className="mb-6 text-4xl font-bold">{data.author?.fullName}</h1>
        <LexicalRenderer
          data={data.author?.bio}
          className="max-w-none"
          fallback={<div className="italic text-gray-500">No bio available.</div>}
        />
      </PageSection>
    </PageShell>
  );
}
