import { getDataForAbout } from 'common/apis/author';
import { Container } from 'components/core/container';
import { Layout } from 'components/core/layout';
import { renderMetaTags } from 'components/core/metadata';
import { LexicalRenderer } from 'components/shared/lexical-renderer';
import { generateMetaTags } from 'common/utils/meta-tags';
import { getCoverImageUrl, getMediaUrl } from 'common/utils/image';
import type { GetStaticProps } from 'next';
import Head from 'next/head';
import type { AboutPageData } from 'types/cms';

interface AboutPageProps {
  homepage: AboutPageData['homepage'];
  author: AboutPageData['author'];
}

export default function About({ homepage, author }: AboutPageProps) {
  // Optimize avatar image for social media previews (Open Graph standard: 1200x630)
  // Use optimizedUrl if available, otherwise transform the base url
  const avatarUrl = getMediaUrl(author?.avatar);
  const metaImageUrl = avatarUrl
    ? getCoverImageUrl(avatarUrl, 1200, 630, 80)
    : undefined;

  const metaTags = generateMetaTags({
    title: `About ${author?.fullName || 'Author'}`,
    description: `Learn more about ${author?.fullName || 'the author'}`,
    image: metaImageUrl,
  });

  return (
    <Layout header={homepage?.header} className="flex flex-col items-center">
      <Head>{renderMetaTags(metaTags)}</Head>
      <Container className="flex flex-col items-center md:px-20 my-4 px-4">
        <h1 className="text-4xl font-bold mb-6">{author?.fullName}</h1>
        {/* Phase 9: Lexical rich text rendering */}
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
    </Layout>
  );
}

export const getStaticProps: GetStaticProps<AboutPageProps> = async () => {
  const data = await getDataForAbout();

  return {
    props: {
      homepage: data.homepage ?? null,
      author: data.author ?? null,
    },
    revalidate: 3600, // Revalidate every hour
  };
};
