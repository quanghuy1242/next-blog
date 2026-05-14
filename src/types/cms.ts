// PayloadCMS Types (migrated from DatoCMS)

import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical';

// Media/Image Types
export interface Media {
  id?: number;
  url?: string;
  optimizedUrl?: string | null; // Pre-computed optimized image URL from backend
  thumbnailURL?: string | null;
  lowResUrl?: string | null; // Pre-generated low-res base64 data URL for blur placeholder
  blurDataURL?: string | null; // Deprecated: use lowResUrl instead
  alt?: string | null;
  filename?: string | null;
  mimeType?: string | null;
  filesize?: number | null;
  width?: number | null;
  height?: number | null;
  focalX?: number | null;
  focalY?: number | null;
  updatedAt?: string;
  createdAt?: string;
}

// User/Author Types (excluding sensitive fields)
export interface Author {
  id: number;
  fullName: string;
  avatar?: Media | null;
  bio?: SerializedEditorState | null; // Lexical editor content
  updatedAt?: string;
  createdAt?: string;
}

// Category Types
export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  image: Media;
  createdBy?: Author | null;
  updatedAt?: string;
  createdAt?: string;
}

// Post Types
export interface PostTag {
  tag: string;
  id?: string;
}

export interface PostMeta {
  title?: string | null;
  description?: string | null;
  image?: Media | null;
}

export type PostStatus = 'draft' | 'published';
export type BookOrigin = 'manual' | 'epub-imported' | 'synced';
export type BookSourceType =
  | 'manual'
  | 'epub-upload'
  | 'meap-feed'
  | 'external-sync';
export type BookImportStatus = 'idle' | 'importing' | 'ready' | 'failed';
export type BookSyncStatus = 'clean' | 'pending' | 'conflicted' | 'diverged';

export interface Post {
  id: number;
  title: string;
  slug: string;
  excerpt?: string | null;
  content?: SerializedEditorState | null; // Lexical editor content
  coverImage?: Media | null;
  author?: Author | null;
  category?: Category | null;
  tags?: PostTag[] | null;
  meta?: PostMeta | null;
  _status?: PostStatus;
  updatedAt?: string;
  createdAt?: string;
}

// Book Types
export interface Book {
  id: number;
  title: string;
  author?: string | null;
  description?: string | null;
  language?: string | null;
  slug: string;
  visibility?: 'public' | 'private';
  chapterCount?: number | null;
  totalWordCount?: number | null;
  cover?: Media | null;
  origin: BookOrigin;
  sourceType: BookSourceType;
  sourceId?: string | null;
  sourceHash?: string | null;
  sourceVersion?: string | null;
  syncStatus: BookSyncStatus;
  importBatchId?: string | null;
  importStatus: BookImportStatus;
  importTotalChapters?: number | null;
  importCompletedChapters?: number | null;
  importStartedAt?: string | null;
  importFinishedAt?: string | null;
  importFailedAt?: string | null;
  lastImportedAt?: string | null;
  importErrorSummary?: string | null;
  readingProgressPct?: number | null;
  createdBy?: Author | number | null;
  _status?: PostStatus;
  updatedAt?: string;
  createdAt?: string;
}

// Chapter Types
export interface Chapter {
  id: number;
  title: string;
  book: Book | number;
  order: number;
  slug: string;
  chapterWordCount?: number | null;
  chapterSourceKey?: string | null;
  chapterSourceHash?: string | null;
  importBatchId?: string | null;
  manualEditedAt?: string | null;
  hasPassword?: boolean | null;
  content: SerializedEditorState | null;
  createdBy?: Author | number | null;
  _status?: PostStatus;
  updatedAt?: string;
  createdAt?: string;
}

// Homepage Global Types
export interface HomepageMeta {
  title?: string | null;
  description?: string | null;
  image?: Media | null;
}

export interface Homepage {
  header?: string | null;
  subHeader?: string | null;
  imageBanner?: Media | null;
  meta?: HomepageMeta | null;
  updatedAt?: string;
  createdAt?: string;
}

// Paginated Response Types
export interface PaginatedResponse<T> {
  docs: T[];
  hasNextPage: boolean;
  hasPrevPage: boolean;
  limit: number;
  page: number;
  totalDocs: number;
  totalPages: number;
}

export interface SimilarPostsResult {
  docs: Post[];
  totalDocs: number;
}

// Page Data Types (for backwards compatibility)
export interface HomePageData {
  allPosts: Post[];
  allCategories: Category[];
  homepage: Homepage | null;
  author: Author | null;
}

export interface AboutPageData {
  author: Author | null;
  homepage: Pick<Homepage, 'header'> | null;
}

export interface PostSlugData {
  post: Post | null;
  morePosts: Post[];
  homepage: Pick<Homepage, 'header'> | null;
}

export interface BooksPageData {
  books: Book[];
  homepage: Pick<Homepage, 'header'> | null;
  hasMore: boolean;
}

export interface BookSlugData {
  book: Book | null;
  chapters: Chapter[];
  homepage: Pick<Homepage, 'header'> | null;
}

export interface ChapterSlugData {
  book: Book | null;
  chapter: Chapter | null;
  chapters: Chapter[];
  homepage: Pick<Homepage, 'header'> | null;
}

// Meta Tags Generation (replacement for react-datocms renderMetaTags)
export interface MetaTag {
  tag: string;
  attributes?: Record<string, string>;
  content?: string | null;
}

// Utility type for normalized tags (converting PostTag[] to string[])
export type NormalizedTags = string[];

// Reading Progress Types
export interface ReadingProgressRecord {
  chapterId: string | null;
  progress: number | null;
  completedAt: string | null;
  updatedAt: string | null;
}

export interface ReadingProgressResult {
  records: ReadingProgressRecord[];
}

// Bookmark Types
export interface BookmarkRecord {
  id: number;
  contentType: 'chapter' | 'book';
  chapter: {
    id: number;
    title: string;
    slug: string;
    book: {
      id: number;
      title: string;
      slug: string;
    } | null;
  } | null;
  book: {
    id: number;
    title: string;
    slug: string;
  } | null;
}

export interface BookmarksResult {
  docs: BookmarkRecord[];
  totalDocs: number;
}

// Comment Types
export type CommentStatus = 'pending' | 'approved' | 'rejected';

export interface CommentAuthor {
  id: number;
  fullName: string;
  avatar?: Media | null;
}

export interface PublicComment {
  id: string;
  content: string;
  status: CommentStatus;
  createdAt: string | null;
  updatedAt: string | null;
  parentCommentId: string | null;
  chapterId: string | null;
  postId: string | null;
  isOwnPending: boolean;
  isDeleted: boolean;
  viewerCanEdit: boolean;
  viewerCanDelete: boolean;
  editWindowEndsAt: string | null;
  author: CommentAuthor;
}

export interface CommentsResult {
  docs: PublicComment[];
  totalDocs: number;
  viewerCanComment: boolean;
}

// Preview Token Types
export interface PreviewTokenResult {
  token: string;
  slug: string;
}
