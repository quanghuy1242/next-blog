import { getDataForAbout } from 'common/apis/author';
import { Container } from 'components/core/container';
import { Layout } from 'components/core/layout';
import { renderMetaTags } from 'components/core/metadata';
import { generateMetaTags } from 'common/utils/meta-tags';
import { getCoverImageUrl } from 'common/utils/image';
import type { GetStaticProps } from 'next';
import Head from 'next/head';
import type { AboutPageData } from 'types/cms';

interface AboutPageProps {
  homepage: AboutPageData['homepage'];
  author: AboutPageData['author'];
  bioContent: string;
}

export default function About({
  homepage,
  author,
  bioContent,
}: AboutPageProps) {
  // Optimize avatar image for social media previews (Open Graph standard: 1200x630)
  const metaImageUrl = author?.avatar?.url
    ? getCoverImageUrl(author.avatar.url, 1200, 630, 80)
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
        {/* Temporary: Display raw JSON bio (Phase 4) */}
        {/* TODO Phase 9: Replace with Lexical rendering */}
        <div className="w-full max-w-4xl">
          <pre className="bg-gray-100 p-4 rounded overflow-x-auto text-sm">
            {bioContent}
          </pre>
        </div>
      </Container>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps<AboutPageProps> = async () => {
  const data = await getDataForAbout();
  const author = data.author ?? null;

  // Temporary: Display raw JSON bio (Phase 4)
  // TODO Phase 9: Replace with Lexical rendering
  const bioContent = author?.bio
    ? JSON.stringify(author.bio, null, 2)
    : 'No bio available';

  return {
    props: {
      homepage: data.homepage ?? null,
      author,
      bioContent,
    },
    revalidate: 3600, // Revalidate every hour
  };
};
