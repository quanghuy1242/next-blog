import type { Post, PostSlugData, SimilarPostsResult } from '@/types/cms';
import { fetchAPI } from './base';
import {
  buildPostDetailCacheTags,
  buildPostSlugCacheTags,
  buildSimilarPostsCacheTags,
  normalizeCacheTags,
  ONE_HOUR_PAYLOAD_CACHE,
} from './cache';

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
  const trimmedSlug = slug.trim();

  if (!trimmedSlug) {
    return {
      post: null,
      morePosts: [],
      homepage: null,
    };
  }

  const payloadCache = options.draftMode ? undefined : ONE_HOUR_PAYLOAD_CACHE;
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
        slug: trimmedSlug,
      },
      cache: payloadCache,
      cacheKeySuffix: { route: 'post-by-slug', slug: trimmedSlug },
      getCacheTags: (data) => {
        const post = data?.Posts?.docs?.[0] ?? null;

        return normalizeCacheTags([
          ...buildPostSlugCacheTags(trimmedSlug),
          ...buildPostDetailCacheTags(post?.id),
        ]);
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
        cache: payloadCache,
        cacheKeySuffix: { route: 'similar-posts', postId: post.id },
        getCacheTags: () =>
          normalizeCacheTags([
            ...buildPostDetailCacheTags(post.id),
            ...buildSimilarPostsCacheTags(post.id),
          ]),
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
