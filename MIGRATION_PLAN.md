# Migration Plan: DatoCMS to PayloadCMS GraphQL Backend

## Overview

This document outlines the migration plan from DatoCMS to a new PayloadCMS-based GraphQL backend. The migration involves updating GraphQL queries, adapting data structures, and potentially refactoring components to work with the new schema.

---

## Schema Comparison & Analysis

### ✅ **Supported Entities (Direct Migration)**

#### 1. **Posts**

- **Current (DatoCMS)**: `allPosts` query
- **New (PayloadCMS)**: `Posts` query
- **Key Differences**:
  - Uses `Posts` instead of `allPosts`
  - Returns paginated structure with `docs`, `hasNextPage`, etc.
  - Content field returns `JSON` instead of markdown string
  - Tags structure changed from `string[]` to `[Post_Tags!]` (array of objects with `tag` and `id`)
  - New `_status` field (`draft` | `published`)
  - Supports draft/trash modes via query parameters

#### 2. **Categories**

- **Current (DatoCMS)**: `allCategories` query
- **New (PayloadCMS)**: `Categories` query
- **Key Differences**:
  - Uses `Categories` instead of `allCategories`
  - `createdBy` field instead of implicit author tracking
  - Image is required (`image: Media!`)
  - Description is required

#### 3. **Media/Images**

- **Current (DatoCMS)**: Uses DatoCMS's responsive image API with `responsiveImageFragment`
- **New (PayloadCMS)**: `Media` type with different structure
- **Key Differences**:
  - No built-in responsive image generation
  - Media fields: `url`, `thumbnailURL`, `filename`, `mimeType`, `filesize`, `width`, `height`, `focalX`, `focalY`
  - No `responsiveImage`, `webpSrcSet`, `srcSet`, `base64` (LQIP) support
  - Requires `owner` (User reference)

#### 4. **Homepage**

- **Current (DatoCMS)**: `homepage` query with SEO metadata
- **New (PayloadCMS)**: `Homepage` query (singular global)
- **Key Differences**:
  - Has `imageBanner: Media` field (new)
  - Meta structure uses `Homepage_Meta` type (nested object)
  - No built-in `_seoMetaTags` - meta fields are explicit

#### 5. **User/Author**

- **Current (DatoCMS)**: `author` query with fields like `displayName`, `name`, `picture`
- **New (PayloadCMS)**: `User` type
- **Key Differences**:
  - Uses `fullName` instead of `displayName`
  - No `displayName` field
  - Authentication-related fields present (`email`, `role`, `sessions`)
  - More restrictive (authentication system)

---

## ⚠️ **Breaking Changes & Unsupported Features**

### 1. **Responsive Images**

**Issue**: DatoCMS provides built-in responsive image generation with multiple srcSets, WebP support, LQIP (Low Quality Image Placeholders), and more. PayloadCMS returns only basic image URLs.

**Current Usage**:

```graphql
coverImage {
  responsiveImage(imgixParams: { fm: jpg, fit: crop, w: 2000, h: 1000 }) {
    srcSet
    webpSrcSet
    sizes
    src
    width
    height
    aspectRatio
    alt
    title
    bgColor
    base64
  }
}
```

**New Schema**:

```graphql
coverImage {
  url
  thumbnailURL
  width
  height
  focalX
  focalY
}
```

**✅ SOLUTION**: Use **Cloudflare R2 with Image Transformations**

- The `url` field contains the direct R2 object URL
- Apply Cloudflare's image transformation parameters to URLs
- Create helper functions to generate responsive image URLs with different sizes/formats
- Replace DatoCMS `responsiveImageFragment` with Cloudflare transformation utilities

**Implementation Approach**:

```typescript
// Example: Transform R2 URL with Cloudflare parameters
function transformR2Image(
  url: string,
  options: {
    width?: number;
    height?: number;
    format?: 'webp' | 'avif' | 'jpeg';
    quality?: number;
    fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
  }
) {
  const params = new URLSearchParams();
  if (options.width) params.set('width', options.width.toString());
  if (options.height) params.set('height', options.height.toString());
  if (options.format) params.set('format', options.format);
  if (options.quality) params.set('quality', options.quality.toString());
  if (options.fit) params.set('fit', options.fit);

  return `${url}?${params.toString()}`;
}
```

---

### 2. **SEO Metadata**

**Issue**: DatoCMS provides `_seoMetaTags` helper that generates meta tags. PayloadCMS has a `meta` object but no automatic tag generation.

**Current Usage**:

```typescript
renderMetaTags(post?.metadata || []);
```

**New Schema**:

```graphql
meta: Post_Meta {
  title: String
  description: String
  image: Media
}
```

**✅ SOLUTION**: Create custom `renderMetaTags` function

- Build custom function to convert `Post_Meta` to HTML meta tags
- Generate Open Graph meta tags (og:title, og:description, og:image, etc.)
- Generate Twitter Card meta tags (twitter:card, twitter:title, etc.)
- Maintain same behavior as DatoCMS implementation
- Remove all `react-datocms` dependencies

**Implementation Approach**:

```typescript
function renderMetaTags(meta: Post_Meta, post?: Post) {
  return (
    <>
      <title>{meta.title || post?.title}</title>
      <meta name="description" content={meta.description} />
      <meta property="og:title" content={meta.title} />
      <meta property="og:description" content={meta.description} />
      <meta property="og:image" content={meta.image?.url} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={meta.title} />
      <meta name="twitter:description" content={meta.description} />
      <meta name="twitter:image" content={meta.image?.url} />
    </>
  );
}
```

---

### 3. **Content Format**

**Issue**: Content is stored as `JSON` (Lexical editor state) instead of markdown.

**Current Implementation**:

- Content is markdown string
- Converted to HTML using `remark` with directive support

**New Implementation**:

```graphql
content(depth: Int): JSON
```

**✅ SOLUTION**: Use **@payloadcms/richtext-lexical** for rendering

- Install `@payloadcms/richtext-lexical` package
- The `content` JSON field contains Lexical editor state
- Use Lexical's React components to render the rich text content
- Replace `markdownToHtml` function with Lexical renderer

**Implementation Approach**:

```typescript
import { RichText } from '@payloadcms/richtext-lexical/react';

// In component
<RichText data={post.content} />;
```

**Migration Notes**:

- Need to migrate existing markdown content to Lexical format (manual or scripted)
- Lexical supports custom nodes for YouTube embeds and other directives
- Can implement similar directive functionality using Lexical plugins

---

### 4. **Tags Structure**

**Issue**: Tags changed from simple string array to array of objects.

**Current**: `tags: string[] | string | null`

**New**:

```graphql
tags: [Post_Tags!]
type Post_Tags {
  tag: String
  id: String
}
```

**✅ SOLUTION**: Update tag handling to use object structure

- The `id` field is auto-generated by PayloadCMS
- Maintain same behavior as existing implementation
- Update utility functions to extract tag strings from objects
- No change to deduplication logic (keep existing behavior)

**Implementation Approach**:

```typescript
// Extract tag strings from Post_Tags objects
function normalizeTags(tags: Post_Tags[] | null): string[] {
  if (!tags) return [];
  return tags.map((t) => t.tag).filter(Boolean);
}

// Use in components
const tagStrings = normalizeTags(post.tags);
```

**Impact**: Minimal - just need adapter functions to convert object array to string array

---

### 5. **Author Information**

**Issue**: Author field structure changes significantly.

**Current**:

```typescript
author: {
  displayName?: string | null;
  name?: string;
  picture: { url?: string | null; }
}
```

**New**:

```graphql
author: User {
  fullName: String!
  email: EmailAddress!
  role: User_role
}
```

**📝 TODO**: Pending decisions on:

1. Display name mapping - use `fullName` directly or add custom field
2. Email visibility - keep private or expose publicly
3. Profile picture storage - confirm if using Media collection or custom field

**Temporary Approach**:

- Map `fullName` to `displayName` for compatibility
- Filter out `email` from public queries for now
- Investigate User-Media relationship for profile pictures

---

### 6. **Pagination**

**Issue**: Different pagination approach.

**Current (DatoCMS)**:

```graphql
allPosts(first: $first, skip: $skip, filter: $filter)
```

**New (PayloadCMS)**:

```graphql
Posts(limit: $limit, page: $page, where: $where)
```

Returns:

```graphql
{
  docs: [Post!]!
  hasNextPage: Boolean!
  hasPrevPage: Boolean!
  limit: Int!
  page: Int!
  totalDocs: Int!
  totalPages: Int!
}
```

**Impact**: Need to refactor pagination logic in `useHomePosts` hook and other places.

---

### 7. **Filtering/Where Clauses**

**Issue**: DatoCMS uses different filter syntax than PayloadCMS.

**Current (DatoCMS)**:

```graphql
filter: {
  category: { eq: $categoryId }
  tags: { matches: { pattern: $pattern, caseSensitive: false } }
}
```

**New (PayloadCMS)**:

```graphql
where: {
  category: { equals: $categoryId }
  tags__tag: { like: $pattern }
}
```

**Impact**: Need to rewrite `createPostsFilter` function and all filter logic.

---

### 8. **Similar Posts Feature**

**New Feature**: PayloadCMS provides a `SimilarPosts` query!

```graphql
SimilarPosts(postId: Int!, limit: Int = 4): SimilarPostsResult
```

This is a **new capability** not present in current implementation.

**✅ SOLUTION**: Use SimilarPosts query for "More posts" section

- Replace the current "latest posts" query on post detail page
- Use `SimilarPosts(postId: post.id, limit: 2)` query
- Algorithm scores posts by category and tags similarity
- Provides more relevant recommendations than latest posts

**Implementation Changes**:

```graphql
# Replace in pages/posts/[slug].tsx query
SimilarPosts(postId: $postId, limit: 2) {
  docs {
    title
    slug
    excerpt
    date
    coverImage { url width height }
    author { fullName }
    category { name slug }
    tags { tag }
  }
  totalDocs
}
```

**Benefits**:

- Better user engagement with relevant content
- Automatic scoring based on category and tags
- No need to filter current post manually

---

### 9. **About Page / External Content**

**Issue**: Current implementation fetches external content (GitHub README).

**Current**:

```typescript
author(filter: { name: { eq: "quanghuy1242" } }) {
  externalContentUrl
}
```

**New Schema**: User type doesn't have `externalContentUrl` field.

**✅ SOLUTION**: Hardcode external README URL temporarily

- Hardcode the `externalContentUrl` in the about page component
- Can be updated later when User schema is extended or About page collection is created

**Implementation Approach**:

```typescript
// pages/about.tsx
const EXTERNAL_README_URL =
  'https://raw.githubusercontent.com/quanghuy1242/quanghuy1242/main/README.md';

export const getStaticProps: GetStaticProps<AboutPageProps> = async () => {
  // Fetch content directly from hardcoded URL
  const md = await getDataContentForAbout(EXTERNAL_README_URL);
  const githubReadMeContent = await markdownToHtml(md || '');

  // ... rest of the implementation
};
```

**Future Improvement**: Add `externalContentUrl` custom field to User collection or create dedicated About collection

---

### 10. **Draft & Publish Workflow**

**New Feature**: PayloadCMS supports draft/published status and versioning.

**New Fields**:

- `_status: Post__status` (draft | published)
- `versionPost` query for accessing versions
- Draft/trash parameters on queries

**✅ SOLUTION**: Filter for published posts by quanghuy1242 only

- Add `where` filter to show only published posts: `_status: { equals: published }`
- Filter by author: `author: { equals: <quanghuy1242_user_id> }`
- Maintain same behavior as existing implementation
- No draft preview mode needed (not used in current implementation)
- No version history features in frontend

**Implementation Approach**:

```graphql
query Posts($limit: Int!, $page: Int!, $where: Post_where) {
  Posts(
    limit: $limit
    page: $page
    where: {
      _status: { equals: published }
      author: { equals: $authorId }
      AND: [$where]
    }
  ) {
    docs { ... }
  }
}
```

**Note**: Need to determine `quanghuy1242` user ID from the User query first

---

## 📋 **Confirmed Solutions & Remaining Questions**

### ✅ Confirmed Solutions:

1. **Image Handling**:

   - ✅ Using Cloudflare R2 with image transformation
   - ✅ Apply transformations via URL parameters (width, height, format, quality, fit)
   - ✅ Replace DatoCMS responsive image fragment with R2 transformation utilities

2. **Content Format**:

   - ✅ Using Lexical editor
   - ✅ Install `@payloadcms/richtext-lexical` package
   - ✅ Content JSON field contains Lexical editor state
   - ✅ Use Lexical React components for rendering

3. **About Page**:

   - ✅ Hardcode external README URL temporarily
   - ✅ Will be updated later with proper User schema extension or About collection

4. **SEO Metadata**:

   - ✅ Create custom `renderMetaTags` function
   - ✅ Generate Open Graph and Twitter Card meta tags
   - ✅ Remove all `react-datocms` dependencies
   - ✅ Maintain same behavior as existing implementation

5. **Tags Structure**:

   - ✅ Tag IDs are auto-generated
   - ✅ Keep same normalization behavior as existing implementation
   - ✅ Create adapter functions to convert object array to string array

6. **Similar Posts**:

   - ✅ Use `SimilarPosts` query for "More posts" section on post detail page
   - ✅ Algorithm scores by category and tags
   - ✅ Replace current "latest posts" approach

7. **Draft/Publish Workflow**:
   - ✅ Show only published posts (`_status: published`)
   - ✅ Filter by author "quanghuy1242"
   - ✅ No draft preview mode needed
   - ✅ No version history features needed

### 📝 Remaining Questions (TODO):

1. **Author/User Data**:

   - ❓ Should User.email be public or filtered out in queries?
   - ❓ Where are author profile pictures stored? (Media collection or custom field?)
   - ❓ Use `fullName` as `displayName` or add custom field?
   - ❓ What is the user ID for "quanghuy1242" to filter posts?

2. **API Configuration**:

   - ❓ What is the GraphQL endpoint URL?
   - ❓ Does it require authentication for public queries?
   - ❓ Are there rate limits or query complexity limits?

3. **Content Migration**:
   - ❓ Do you have existing markdown content that needs migrating to Lexical format?
   - ❓ Should we create a migration script or manual process?

---

## 🗺️ **Migration Strategy**

### Phase 1: Setup & Configuration (Day 1)

1. Update environment variables with new GraphQL endpoint
2. Remove `react-datocms` dependency
3. Install any required PayloadCMS client libraries
4. Configure authentication if needed

### Phase 2: Type Definitions (Day 1-2)

1. Create new TypeScript types based on PayloadCMS schema
2. Update `types/datocms.ts` to match new schema
3. Create type mappers for backward compatibility where possible

### Phase 3: Core API Layer (Day 2-3)

1. Update `common/apis/base.ts`:
   - Remove DatoCMS `responsiveImageFragment`
   - Create Cloudflare R2 image transformation utilities
   - Update fetchAPI function if auth is needed
2. Rewrite query functions:
   - `common/apis/posts.ts` - Update pagination & filtering
   - `common/apis/posts.slug.ts` - Update post query, keep content as JSON
   - `common/apis/categories.ts` - Update categories query
   - `common/apis/index.ts` - Update homepage query
   - `common/apis/author.ts` - Update user/author query

### Phase 4: Content Rendering (Day 3-4)

1. Install `@payloadcms/richtext-lexical` package
2. Replace `markdownToHtml` with Lexical renderer component
3. Create Cloudflare R2 image helper functions:
   - Generate responsive image URLs with transformations
   - Support multiple formats (WebP, AVIF, JPEG)
   - Generate srcSet for different screen sizes
4. Create custom `renderMetaTags` function:
   - Convert `Post_Meta` to HTML meta tags
   - Generate Open Graph tags
   - Generate Twitter Card tags
   - Replace `react-datocms` renderMetaTags
5. Update `CoverImage` component to use R2 transformations
6. Create tag normalization utility functions

### Phase 5: Component Updates (Day 4-5)

1. Update `CoverImage` component for new image structure
2. Update `Posts` component for new tag structure
3. Update metadata rendering (remove `renderMetaTags` usage)
4. Update author display components

### Phase 6: Page Updates (Day 5-6)

1. Update `pages/index.tsx` - Homepage with new queries
   - Add filter for published posts by quanghuy1242
2. Update `pages/posts/[slug].tsx` - Post detail page
   - Use Lexical renderer for content
   - Replace "More posts" with `SimilarPosts` query
   - Update metadata rendering with custom function
3. Update `pages/about.tsx` - Hardcode external README URL
4. Update `pages/categories.tsx` if exists
   - Add published posts filter

### Phase 7: Hooks & State (Day 6)

1. Update `useHomePosts` hook for new pagination
2. Update filter logic in context/state
3. Update utils functions for new data structures

### Phase 8: Testing & Validation (Day 7)

1. Test all pages and features
2. Verify SEO metadata generation
3. Test pagination and filtering
4. Validate image loading and responsiveness
5. Update test files

### Phase 9: Deployment Preparation (Day 8)

1. Update environment variables documentation
2. Create migration runbook
3. Plan data migration if needed
4. Create rollback plan

---

## 🔧 **Technical Debt & Improvements**

Consider these improvements during migration:

1. **Image Optimization** (Using Cloudflare R2):

   - ✅ Create utility functions for R2 image transformations
   - ✅ Generate responsive srcSet with multiple widths
   - ✅ Support modern formats (WebP, AVIF) with JPEG fallback
   - Implement Next.js Image component integration
   - Consider lazy loading and blur placeholders
   - Document R2 transformation parameters and limits

2. **Content Management** (Using Lexical):

   - ✅ Install and configure `@payloadcms/richtext-lexical`
   - Create reusable Lexical renderer component
   - Implement custom Lexical nodes for special content (YouTube embeds, code blocks, etc.)
   - Consider creating a Lexical editor preview mode
   - Document Lexical plugin system usage

3. **Caching**:

   - Implement GraphQL query caching
   - Use Next.js ISR more effectively
   - Consider adding Redis for API response caching
   - Cache transformed R2 image URLs

4. **Type Safety**:

   - Generate TypeScript types from GraphQL schema automatically
   - Use GraphQL Codegen for type-safe queries
   - Implement runtime type validation for API responses

5. **Error Handling**:
   - Better error boundaries
   - Fallback UI for failed image loads from R2
   - Retry logic for failed API calls
   - Handle Lexical rendering errors gracefully

---

## 📦 **Dependencies Changes**

### ✅ Required Additions:

- `@payloadcms/richtext-lexical` - **Required** for rendering Lexical content
- `@lexical/react` - React bindings for Lexical (likely included with above)
- `graphql-request` - Lightweight GraphQL client (optional, can continue using fetch)
- `@graphql-codegen/cli` - Generate TypeScript types from schema (recommended)

### ⚠️ To Remove:

- `react-datocms` - DatoCMS specific, no longer needed
- `remark` - Replaced by Lexical renderer
- `remark-html` - Replaced by Lexical renderer
- `remark-directive` - Lexical has its own plugin system

### 🔧 Keep (for now):

- `hastscript` - May still be useful for HTML manipulation
- Keep markdown processing temporarily for About page external content

---

## 🎯 **Success Criteria**

Migration is complete when:

- ✅ All pages render correctly with PayloadCMS data
- ✅ Images display properly using Cloudflare R2 transformations
- ✅ Responsive images work with different sizes and formats
- ✅ Lexical content renders correctly on all post pages
- ✅ SEO metadata (Open Graph + Twitter Cards) is correctly generated from Post_Meta
- ✅ Custom `renderMetaTags` function works properly
- ✅ Only published posts by quanghuy1242 are shown on frontend
- ✅ Similar posts feature works on post detail pages
- ✅ Pagination works correctly with new schema
- ✅ Filtering by category/tags works with new where clauses
- ✅ Tag structure (object array) is properly handled
- ✅ About page loads external README content
- ✅ All tests pass and updated for new data structures
- ✅ No DatoCMS dependencies remain (`react-datocms` removed)
- ✅ Performance is equal or better than before
- ✅ Image loading performance is optimized with R2 transformations

---

## 📝 **Next Steps**

1. **Review & Answer Questions**: Go through all questions marked with ❓
2. **Provide Sample Data**: Share example responses from PayloadCMS API
3. **Confirm Priorities**: Identify must-have vs nice-to-have features
4. **Set Timeline**: Agree on migration timeline based on complexity
5. **Create Subtasks**: Break down each phase into actionable tasks

---

## 🚨 **Risk Assessment**

| Risk                               | Impact | Likelihood | Mitigation                                                            |
| ---------------------------------- | ------ | ---------- | --------------------------------------------------------------------- |
| Lexical rendering issues           | High   | Medium     | ✅ Use official @payloadcms/richtext-lexical package, test thoroughly |
| R2 image transformation limits     | Medium | Low        | ✅ Document R2 limits, implement fallbacks, cache URLs                |
| Image quality/performance issues   | Medium | Low        | ✅ Use Cloudflare R2 transformations optimally, test formats          |
| SEO impact from metadata changes   | High   | Low        | Create comprehensive meta tag generator                               |
| Breaking changes in production     | High   | Low        | Thorough testing, staged rollout                                      |
| Performance regression             | Medium | Medium     | Load testing, caching strategy, optimize R2 queries                   |
| Filter/search functionality breaks | Medium | Medium     | Unit tests for filter logic with new where syntax                     |
| Content migration complexity       | Medium | Medium     | Plan markdown→Lexical migration carefully                             |
| Migration timeline overrun         | Medium | High       | Buffer time in estimate, prioritize features                          |

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-23  
**Status**: Awaiting Feedback
