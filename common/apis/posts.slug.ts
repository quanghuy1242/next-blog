import type { PostSlugData, Post, SimilarPostsResult } from '../../types/cms';
import { fetchAPI } from './base';

interface PostSlugResponse {
  Posts: {
    docs: Post[];
  };
  SimilarPosts: SimilarPostsResult;
  Homepage: {
    header: string | null;
  } | null;
}

export async function getDataForPostSlug(slug: string): Promise<PostSlugData> {
  const data = await fetchAPI<PostSlugResponse>(
    `#graphql
    query PostBySlug($slug: String!) {
      Posts(
        where: {
          AND: [
            { slug: { equals: $slug } }
            { _status: { equals: published } }
          ]
        }
        limit: 1
      ) {
        docs {
          id
          title
          slug
          content
          excerpt
          createdAt
          updatedAt
          coverImage {
            id
            url
            thumbnailURL
            lowResUrl
            alt
            width
            height
          }
          author {
            id
            fullName
            avatar {
              id
              url
              thumbnailURL
              lowResUrl
              alt
            }
          }
          category {
            id
            name
            slug
          }
          tags {
            tag
            id
          }
          meta {
            title
            description
            image {
              url
              lowResUrl
            }
          }
        }
      }

      Homepage {
        header
      }
    }
    `,
    {
      variables: {
        slug,
      },
    }
  );

  const post = data?.Posts?.docs?.[0] ?? null;

  // If we have a post, fetch similar posts using its ID
  let morePosts: Post[] = [];
  if (post?.id) {
    const similarData = await fetchAPI<{ SimilarPosts: SimilarPostsResult }>(
      `#graphql
      query SimilarPosts($postId: Int!) {
        SimilarPosts(postId: $postId, limit: 2) {
          docs {
            id
            title
            slug
            excerpt
            createdAt
            updatedAt
            coverImage {
              id
              url
              thumbnailURL
              lowResUrl
              alt
              width
              height
            }
            author {
              id
              fullName
              avatar {
                url
                thumbnailURL
                lowResUrl
                alt
              }
            }
            category {
              id
              name
              slug
            }
            tags {
              tag
              id
            }
          }
          totalDocs
        }
      }
      `,
      {
        variables: {
          postId: post.id,
        },
      }
    );
    morePosts = similarData?.SimilarPosts?.docs ?? [];
  }

  return {
    post,
    morePosts,
    homepage: data?.Homepage ?? null,
  };
}
