import type { CommentsResult, PublicComment } from 'types/cms';
import { fetchAPIWithAuthToken } from './base';

const COMMENTS_QUERY = `#graphql
  query Comments($chapterId: ID, $postId: ID) {
    comments(chapterId: $chapterId, postId: $postId) {
      docs {
        id
        content
        status
        createdAt
        updatedAt
        parentCommentId
        chapterId
        postId
        isOwnPending
        isDeleted
        viewerCanEdit
        viewerCanDelete
        editWindowEndsAt
        author {
          id
          fullName
          avatar {
            id
            url
            thumbnailURL
            optimizedUrl
            lowResUrl
            alt
          }
        }
      }
      totalDocs
      viewerCanComment
    }
  }
`;

const CREATE_COMMENT_MUTATION = `#graphql
  mutation CreateComment($chapterId: ID, $postId: ID, $content: String!, $parentCommentId: ID) {
    createComment(chapterId: $chapterId, postId: $postId, content: $content, parentCommentId: $parentCommentId) {
      comment {
        id
        content
        status
        createdAt
        updatedAt
        parentCommentId
        chapterId
        postId
        isOwnPending
        isDeleted
        viewerCanEdit
        viewerCanDelete
        editWindowEndsAt
        author {
          id
          fullName
          avatar {
            id
            url
            thumbnailURL
            optimizedUrl
            lowResUrl
            alt
          }
        }
      }
    }
  }
`;

const UPDATE_COMMENT_MUTATION = `#graphql
  mutation UpdateComment($commentId: ID!, $content: String!) {
    updateComment(commentId: $commentId, content: $content) {
      comment {
        id
        content
        status
        createdAt
        updatedAt
        parentCommentId
        chapterId
        postId
        isOwnPending
        isDeleted
        viewerCanEdit
        viewerCanDelete
        editWindowEndsAt
        author {
          id
          fullName
        }
      }
    }
  }
`;

const DELETE_COMMENT_MUTATION = `#graphql
  mutation DeleteComment($commentId: ID!) {
    deleteComment(commentId: $commentId) {
      comment {
        id
        isDeleted
        status
        parentCommentId
        chapterId
        postId
        viewerCanEdit
        viewerCanDelete
        author {
          id
          fullName
        }
      }
    }
  }
`;

interface CommentsResponse {
  comments: CommentsResult | null;
}

interface CreateCommentResponse {
  createComment: {
    comment: PublicComment | null;
  } | null;
}

interface UpdateCommentResponse {
  updateComment: {
    comment: PublicComment | null;
  } | null;
}

interface DeleteCommentResponse {
  deleteComment: {
    comment: {
      id: string;
      isDeleted: boolean;
      status: string;
      parentCommentId: string | null;
      chapterId: string | null;
      postId: string | null;
      viewerCanEdit: boolean;
      viewerCanDelete: boolean;
      author: { id: string; fullName: string };
    } | null;
  } | null;
}

function buildCommentRequestHeaders(chapterPasswordProof?: string | null): Record<string, string> | undefined {
  if (!chapterPasswordProof) {
    return undefined;
  }

  return {
    'x-chapter-password-proof': chapterPasswordProof,
  };
}

export async function getComments(
  target: { chapterId?: string; postId?: string },
  options: { authToken?: string | null; chapterPasswordProof?: string | null } = {}
): Promise<CommentsResult> {
  if (!target.chapterId && !target.postId) {
    return { docs: [], totalDocs: 0, viewerCanComment: false };
  }

  const requestHeaders: Record<string, string> = {};
  if (options.chapterPasswordProof) {
    requestHeaders['x-chapter-password-proof'] = options.chapterPasswordProof;
  }

  const data = await fetchAPIWithAuthToken<CommentsResponse>(
    COMMENTS_QUERY,
    {
      variables: {
        chapterId: target.chapterId,
        postId: target.postId,
      },
      authToken: options.authToken,
      requestHeaders: Object.keys(requestHeaders).length > 0 ? requestHeaders : undefined,
    }
  );

  return data?.comments ?? { docs: [], totalDocs: 0, viewerCanComment: false };
}

export async function createComment(
  input: { chapterId?: string; postId?: string; content: string; parentCommentId?: string },
  options: { authToken: string; chapterPasswordProof?: string | null }
): Promise<PublicComment | null> {
  const data = await fetchAPIWithAuthToken<CreateCommentResponse>(
    CREATE_COMMENT_MUTATION,
    {
      variables: {
        chapterId: input.chapterId,
        postId: input.postId,
        content: input.content,
        parentCommentId: input.parentCommentId,
      },
      authToken: options.authToken,
      requestHeaders: buildCommentRequestHeaders(options.chapterPasswordProof),
    }
  );

  return data?.createComment?.comment ?? null;
}

export async function updateComment(
  commentId: string,
  content: string,
  options: { authToken: string; chapterPasswordProof?: string | null }
): Promise<PublicComment | null> {
  const data = await fetchAPIWithAuthToken<UpdateCommentResponse>(
    UPDATE_COMMENT_MUTATION,
    {
      variables: { commentId, content },
      authToken: options.authToken,
      requestHeaders: buildCommentRequestHeaders(options.chapterPasswordProof),
    }
  );

  return data?.updateComment?.comment ?? null;
}

export async function deleteComment(
  commentId: string,
  options: { authToken: string; chapterPasswordProof?: string | null }
): Promise<boolean> {
  const data = await fetchAPIWithAuthToken<DeleteCommentResponse>(
    DELETE_COMMENT_MUTATION,
    {
      variables: { commentId },
      authToken: options.authToken,
      requestHeaders: buildCommentRequestHeaders(options.chapterPasswordProof),
    }
  );

  return data?.deleteComment?.comment != null;
}
