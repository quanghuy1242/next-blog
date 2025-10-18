import { getDataForAbout, getDataContentForAbout } from 'common/apis/author';
import markdownToHtml from 'common/markdown-to-html';
import { Container } from 'components/core/container';
import { Layout } from 'components/core/layout';
import type { GetStaticProps } from 'next';
import Head from 'next/head';
import { renderMetaTags } from 'react-datocms';
import type { AboutPageData } from 'types/datocms';

interface AboutPageProps {
  homepage: AboutPageData['homepage'];
  author: AboutPageData['author'];
  githubReadMeContent: string;
}

const AUTHOR_SLUG = 'quanghuy1242';

export default function About({
  homepage,
  author,
  githubReadMeContent,
}: AboutPageProps) {
  return (
    <Layout header={homepage?.header} className="flex flex-col items-center">
      <Head>{renderMetaTags(author?.metadata || [])}</Head>
      <Container className="flex flex-col items-center md:px-20 my-4 px-4">
        <div
          className="prose"
          dangerouslySetInnerHTML={{ __html: githubReadMeContent }}
        />
      </Container>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps<AboutPageProps> = async () => {
  const data = await getDataForAbout(AUTHOR_SLUG);
  const author = data.author ?? null;

  let githubReadMeContent = '';

  const externalContentUrl = author?.externalContentUrl;
  if (externalContentUrl) {
    try {
      const md = await getDataContentForAbout(externalContentUrl);
      githubReadMeContent = await markdownToHtml(md || '');
    } catch (error) {
      console.error('Failed to load external author content', error);
    }
  }

  return {
    props: {
      homepage: data.homepage ?? null,
      author,
      githubReadMeContent,
    },
    revalidate: 60,
  };
};
