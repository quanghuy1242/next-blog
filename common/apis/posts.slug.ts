import type { PostSlugData, Post, SimilarPostsResult } from '../../types/cms';
import { fetchAPI } from './base';

interface PostFetchOptions {
  draftMode?: boolean;
}

interface PostDraftSlugResponse {
  Posts: {
    docs: Post[];
  };
  Homepage: {
    header: string | null;
  } | null;
}

const POST_DETAIL_FIELDS = `
  id
  title
  slug
  content
  excerpt
  createdAt
  updatedAt
  _status
  coverImage {
    id
    url
    optimizedUrl
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
      optimizedUrl
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
      optimizedUrl
      lowResUrl
    }
  }
`;

export async function getDataForPostSlug(
  slug: string,
  options: PostFetchOptions = {}
): Promise<PostSlugData> {
  const statusFilter = options.draftMode
    ? '{ _status: { in: [published, draft] } }'
    : '{ _status: { equals: published } }';

  const data = await fetchAPI<PostDraftSlugResponse>(
    `#graphql
    query PostBySlug($slug: String!) {
      Posts(
        where: {
          AND: [
            { slug: { equals: $slug } }
            ${statusFilter}
          ]
        }
        limit: 1
      ) {
        docs {
          ${POST_DETAIL_FIELDS}
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
              optimizedUrl
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
                optimizedUrl
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