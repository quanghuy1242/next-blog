import type { ResponsiveImageType, SeoOrFaviconTag } from 'react-datocms';

export type ResponsiveImage = ResponsiveImageType;

export interface ResponsiveImageContainer {
  responsiveImage: ResponsiveImage;
}

export type SeoTag = SeoOrFaviconTag;

export interface AuthorPicture {
  url?: string | null;
  responsiveImage?: ResponsiveImage;
}

export interface Author {
  name?: string;
  displayName?: string | null;
  description?: string | null;
  externalContentUrl?: string | null;
  picture: AuthorPicture;
}

export interface CategoryImage {
  responsiveImage: ResponsiveImage;
}

export interface Category {
  name: string;
  description?: string | null;
  slug: string;
  image?: CategoryImage | null;
}

export interface Post {
  title: string;
  slug: string;
  excerpt?: string | null;
  date: string;
  content?: string | null;
  coverImage: ResponsiveImageContainer;
  author: Author;
  category?: Category | string | null;
  tags?: string[] | string | null;
  metadata?: SeoTag[];
  ogImage?: { url: string };
}

export interface Homepage {
  header?: string | null;
  subHeader?: string | null;
  metadata?: SeoTag[];
}

export interface HomePageData {
  allPosts: Post[];
  allCategories: Category[];
  homepage: Homepage | null;
  author: Author | null;
}

export interface AboutPageData {
  author: Pick<
    Author,
    'name' | 'externalContentUrl'
  > & { metadata: SeoTag[] } | null;
  homepage: Pick<Homepage, 'header'> | null;
}

export interface PostSlugData {
  post: Post | null;
  morePosts: Post[];
  homepage: Pick<Homepage, 'header'> | null;
}
