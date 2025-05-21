import { getDataForAbout, getDataContentForAbout } from 'common/apis/author';
import markdownToHtml from 'common/markdown-to-html';
import { Container } from 'components/core/container';
import { Layout } from 'components/core/layout';
import Head from 'next/head';
import { renderMetaTags } from 'react-datocms';

export default function Index({ homepage = {}, author = {}, githubReadMeContent }) {
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

export async function getStaticProps() {
  const apiData = (await getDataForAbout('quanghuy1242')) || {};
  const md = await getDataContentForAbout(apiData?.author?.externalContentUrl);
  const content = await markdownToHtml(md || '');
  return {
    props: {
      homepage: apiData.homepage || {},
      author: apiData.author || {},
      githubReadMeContent: content,
    },
    revalidate: 60,
  };
}
