// PayloadCMS Types (migrated from DatoCMS)

// Media/Image Types
export interface Media {
  id?: number;
  url?: string;
  thumbnailURL?: string | null;
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
  bio?: JSON | null; // Lexical editor content
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

export interface Post {
  id: number;
  title: string;
  slug: string;
  excerpt?: string | null;
  content?: JSON | null; // Lexical editor content
  coverImage?: Media | null;
  author?: Author | null;
  category?: Category | null;
  tags?: PostTag[] | null;
  meta?: PostMeta | null;
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
  id: number;
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

// Meta Tags Generation (replacement for react-datocms renderMetaTags)
export interface MetaTag {
  tag: string;
  attributes?: Record<string, string>;
  content?: string | null;
}

// Utility type for normalized tags (converting PostTag[] to string[])
export type NormalizedTags = string[];
