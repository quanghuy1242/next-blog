import { getDataForHome, getMorePosts } from 'common/apis/index';
import { Container } from 'components/core/container';
import { Layout } from 'components/core/layout';
import { Banner } from 'components/pages/index/banner';
import { Categories } from 'components/shared/categories';
import { Posts } from 'components/shared/posts';
import { Text } from 'components/shared/text';
import Head from 'next/head';
import { renderMetaTags } from 'react-datocms';
import { useState, useEffect, useCallback } from 'react';

const POSTS_PER_PAGE = 10; // Number of posts to fetch per request

export default function Index({ allPosts: initialPosts = [], homepage = {}, allCategories = [] }) {
  const [posts, setPosts] = useState(initialPosts || []);
  const [offset, setOffset] = useState(initialPosts?.length || 0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadMorePosts = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const data = await getMorePosts(POSTS_PER_PAGE, offset);
      const newPosts = data?.allPosts || [];

      if (newPosts.length > 0) {
        setPosts((prevPosts) => [...prevPosts, ...newPosts]);
        setOffset((prevOffset) => prevOffset + newPosts.length);
        if (newPosts.length < POSTS_PER_PAGE) {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Failed to fetch more posts:', error);
      // Optionally, set hasMore to false or show an error message
    }
    setLoading(false);
  }, [loading, hasMore, offset]); // Removed POSTS_PER_PAGE

  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 &&
        !loading &&
        hasMore
      ) {
        loadMorePosts();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading, hasMore, offset, loadMorePosts]); // Add loadMorePosts to dependencies

  // Temporary useEffect to simulate scroll and trigger loadMorePosts
  useEffect(() => {
    console.log('Initial posts length:', initialPosts?.length);
    console.log('Current offset state:', offset);
    // Only run if there are initial posts, to ensure offset is correctly set from them
    if (initialPosts && initialPosts.length > 0) {
      const timer = setTimeout(() => {
        console.log('Timer fired, calling loadMorePosts...');
        loadMorePosts();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [loadMorePosts, initialPosts, offset]); // Added initialPosts and offset to dependencies for safety

  return (
    <Layout header={homepage?.header} className="flex flex-col items-center">
      <Head>{renderMetaTags(homepage?.metadata || [])}</Head>
      <Banner
        header={homepage?.header}
        subHeader={homepage?.subHeader}
        className="w-full"
      />
      <Container className="flex flex-col md:flex-row md:px-20">
        <div className="flex-grow md:w-2/3 md:mr-6">
          <Text text="Latest Posts" />
          <Posts posts={posts} hasMoreCol={false} />
          {loading && <p>Loading more posts...</p>}
        </div>
        <div className="md:w-1/3">
          <Text text="Categories" />
          <Categories categories={allCategories} />
        </div>
      </Container>
    </Layout>
  );
}

export async function getStaticProps() {
  const apiData = (await getDataForHome()) || {};
  return {
    props: {
      allPosts: apiData.allPosts || [],
      homepage: apiData.homepage || {},
      allCategories: apiData.allCategories || [],
    },
    revalidate: 60,
  };
}
