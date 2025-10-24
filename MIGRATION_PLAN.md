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
  - **No `date` field** - use `createdAt` and `updatedAt` for all timestamp needs
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

**✅ SOLUTION**: Defer Lexical rendering to final phase

- **Phase 1 (Initial Migration)**: Display raw JSON content on page
- **Phase 2 (Final Polish)**: Install `@payloadcms/richtext-lexical` and implement proper rendering
- The `content` JSON field contains Lexical editor state
- This approach ensures easier parts are completed first before tackling rich text rendering

**Implementation Approach (Initial - Raw JSON)**:

```typescript
// Temporary: Display raw JSON for verification
<pre>{JSON.stringify(post.content, null, 2)}</pre>
```

**Implementation Approach (Final - Lexical Renderer)**:

```typescript
import { RichText } from '@payloadcms/richtext-lexical/react';

// Final implementation
<RichText data={post.content} />;
```

**Migration Notes**:

- Start with raw JSON display to validate data flow
- Complete all API, routing, filtering, and pagination first
- Implement Lexical rendering in final phase
- Content migration to Lexical format handled manually (no automated script needed)
- Lexical supports custom nodes for YouTube embeds and other directives

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
  id: Int!
  fullName: String!
  avatar: Media  # Nullable - use placeholder if null
  bio(depth: Int): JSON  # Lexical content for about page
  # Exclude from public queries:
  # - email: EmailAddress
  # - apiKey: String
  # - enableAPIKey: Boolean
  # - Other auth fields
}
```

**✅ SOLUTION**: Secure user data handling

- Use `fullName` directly for display (no separate displayName field needed in current impl)
- **Exclude sensitive fields** from all public queries:
  - `email`
  - `apiKey`, `apiKeyIndex`, `enableAPIKey`
  - `resetPasswordToken`, `resetPasswordExpiration`
  - `salt`, `hash`
  - `loginAttempts`, `lockUntil`
  - `sessions`
- `avatar` field references Media collection (nullable) - use public domain placeholder image if null
- Filter posts by author ID = 1 (quanghuy1242)

**Implementation Approach**:

```graphql
# Only query safe fields in public queries
author {
  id
  fullName
  avatar {
    url
    thumbnailURL
    alt
  }
}

# Filter posts by quanghuy1242 (user ID = 1)
Posts(where: { author: { equals: 1 }, _status: { equals: published } })
```

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
    createdAt
    updatedAt
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

### 9. **About Page Content**

**Issue**: Current implementation fetches external content (GitHub README) and converts markdown to HTML.

**Current**:

```typescript
author(filter: { name: { eq: "quanghuy1242" } }) {
  externalContentUrl
}
// Fetches markdown and converts to HTML
const md = await getDataContentForAbout(externalContentUrl);
const content = await markdownToHtml(md || '');
```

**New Schema**: User type has `bio` field with Lexical JSON content.

```graphql
User {
  id: Int!
  fullName: String!
  avatar: Media
  bio(depth: Int): JSON  # Lexical editor content
}
```

**✅ SOLUTION**: Use User bio field with Lexical renderer

- Query the `bio` field from User (ID = 1)
- Render using `@payloadcms/richtext-lexical` like post content
- No markdown processing needed
- No external URL fetching needed

**Implementation Approach**:

```typescript
// pages/about.tsx
import { RichText } from '@payloadcms/richtext-lexical/react';

export const getStaticProps: GetStaticProps<AboutPageProps> = async () => {
  const headers = {
    Authorization: `users API-Key ${process.env.GRAPHQL_API_KEY}`,
  };

  const response = await fetch(
    `${process.env.GRAPHQL_ENDPOINT_BASE_URL}/api/graphql`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: `
        query {
          User(id: 1) {
            fullName
            bio
            avatar {
              url
              alt
            }
          }
        }
      `,
      }),
    }
  );

  const { data } = await response.json();

  return {
    props: {
      user: data.User,
    },
    revalidate: 3600, // ISR - revalidate every hour
  };
};

// In component
<RichText data={user.bio} />;
```

**Benefits**:

- No external dependencies or URL fetching
- Consistent Lexical rendering with post content
- Managed within PayloadCMS admin
- ISR caching for performance

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

### ✅ Questions Answered:

1. **Author/User Data**:

   - ✅ **User.email**: Filter out from public queries (sensitive field)
   - ✅ **User.apiKey**: Filter out from public queries (sensitive field)
   - ✅ **Profile pictures**: Add `avatar` field to User type (nullable Media reference). Use public domain placeholder if null
   - ✅ **Display name**: Use `fullName` field (not using displayName in current impl)
   - ✅ **User ID for "quanghuy1242"**: ID = `1` (integer)

2. **API Configuration**:

   - ✅ **GraphQL endpoint**: `/api/graphql` (base URL from env var)
   - ✅ **Authentication**: All resources protected via API key - use SSR or ISR (prefer ISR with revalidation like current approach)
   - ✅ **Rate limits**: No limits to worry about

3. **Content Migration**:
   - ✅ **Markdown to Lexical**: Manual migration - no automated script needed
   - ✅ **Migration process**: Manual - don't worry about it

---

## 🗺️ **Migration Strategy**

### Phase 1: Setup & Configuration (Day 1)

1. ✅ Configure environment variables:
   - Add `GRAPHQL_ENDPOINT_BASE_URL` for base URL
   - Add `GRAPHQL_API_KEY` for API authentication
   - Endpoint path: `/api/graphql`
2. Remove `react-datocms` dependency
3. Install PayloadCMS client libraries if needed
4. Configure API authentication headers with API key

### Phase 2: Type Definitions (Day 1-2)

1. Create new TypeScript types based on PayloadCMS schema
2. Update `types/datocms.ts` to match new schema:
   - **Exclude sensitive User fields** (email, apiKey, auth fields)
   - Add `avatar` (nullable Media) to User type
   - Map author ID = 1 for quanghuy1242
   - Update Post, Category, Media types
   - **Map `createdAt` to display dates** (no separate `date` field)
   - Use `updatedAt` for "last modified" timestamps
3. Create type mappers for backward compatibility where possible

### Phase 3: Core API Layer (Day 2-3)

1. Update `common/apis/base.ts`:
   - Remove DatoCMS `responsiveImageFragment`
   - Create Cloudflare R2 image transformation utilities
   - Update fetchAPI function with API key authentication headers
   - Set base URL from environment variable
2. Rewrite query functions:
   - `common/apis/posts.ts` - Update pagination & filtering, add author=1 filter
   - `common/apis/posts.slug.ts` - Update post query, keep content as JSON
   - `common/apis/categories.ts` - Update categories query
   - `common/apis/index.ts` - Update homepage query
   - `common/apis/author.ts` - Update user/author query, **exclude sensitive fields**
3. Add ISR with revalidation support (keep existing approach)

### Phase 4: Content Display (Day 3-4) - WITHOUT Lexical Rendering

1. **Display raw JSON content temporarily**:
   - Post content: `<pre>{JSON.stringify(post.content, null, 2)}</pre>`
   - User bio: `<pre>{JSON.stringify(user.bio, null, 2)}</pre>`
   - This validates data flow before implementing complex rendering
2. Create Cloudflare R2 image helper functions:
   - Generate responsive image URLs with transformations
   - Support multiple formats (WebP, AVIF, JPEG)
   - Generate srcSet for different screen sizes
3. Create custom `renderMetaTags` function:
   - Convert `Post_Meta` to HTML meta tags
   - Generate Open Graph tags
   - Generate Twitter Card tags
   - Replace `react-datocms` renderMetaTags
4. Update `CoverImage` component to use R2 transformations
5. Create tag normalization utility functions

**Note**: Lexical rendering deferred to Phase 9 (final polish)

### Phase 5: Component Updates (Day 4-5)

1. Update `CoverImage` component for new image structure with R2 transformations
2. Update `Posts` component for new tag structure
3. Update metadata rendering (replace `react-datocms` with custom function)
4. Update date/timestamp display components:
   - Replace `date` field usage with `createdAt`
   - Use `updatedAt` for "last modified" displays
5. Update author display components:
   - Use `fullName` field
   - Handle nullable `avatar` field with placeholder fallback
   - Ensure no sensitive fields are accessed

### Phase 6: Page Updates (Day 5-6)

1. Update `pages/index.tsx` - Homepage with new queries
   - Add filter for published posts by quanghuy1242 (author ID = 1)
   - Use ISR with revalidation
2. Update `pages/posts/[slug].tsx` - Post detail page
   - **Display raw JSON for content** (temporary)
   - Replace "More posts" with `SimilarPosts` query
   - Update metadata rendering with custom function
   - Add published/author filters
3. Update `pages/about.tsx` - Use User bio field
   - **Display raw JSON for bio** (temporary)
   - Query User(id: 1) with bio field
4. Update `pages/categories.tsx` if exists
   - Add published posts filter (author=1, \_status=published)
5. Update `pages/api/posts.ts` if exists
   - Add API key authentication
   - Add published/author filters

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

### Phase 9: Lexical Rendering Implementation (Day 8) - FINAL PHASE

**This is the final polish phase after all core functionality is working**

1. Install `@payloadcms/richtext-lexical` package:
   ```bash
   npm install @payloadcms/richtext-lexical
   # or
   yarn add @payloadcms/richtext-lexical
   ```
2. Replace raw JSON displays with Lexical renderer:
   - Update post content display: `<RichText data={post.content} />`
   - Update about page bio: `<RichText data={user.bio} />`
3. Create reusable Lexical renderer component wrapper
4. Implement custom Lexical nodes if needed:
   - YouTube embeds
   - Code blocks with syntax highlighting
   - Custom directives
5. Test Lexical rendering across all pages
6. Verify rich text features work correctly:
   - Links
   - Images
   - Lists
   - Headings
   - Custom nodes

### Phase 10: Deployment Preparation (Day 9)

1. Update environment variables documentation:
   - `GRAPHQL_ENDPOINT_BASE_URL` - Base URL for GraphQL API
   - `GRAPHQL_API_KEY` - API key for authentication
   - Document ISR revalidation settings
2. Create migration runbook
3. Plan data migration if needed (manual, no automated script)
4. Create rollback plan
5. Security checklist:
   - Verify no sensitive User fields in public queries
   - Verify API key is properly protected in env vars
   - Test ISR cache behavior with API authentication

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

**Initial Phase (Core Functionality)**:

- `graphql-request` - Lightweight GraphQL client (optional, can continue using fetch)
- `@graphql-codegen/cli` - Generate TypeScript types from schema (recommended)

**Final Phase (Lexical Rendering)**:

- `@payloadcms/richtext-lexical` - **Required** for rendering Lexical content (install in Phase 9)
- `@lexical/react` - React bindings for Lexical (likely included with above)

### ⚠️ To Remove:

- `react-datocms` - DatoCMS specific, no longer needed
- `remark` - Replaced by Lexical renderer
- `remark-html` - Replaced by Lexical renderer
- `remark-directive` - Lexical has its own plugin system
- `hastscript` - No longer needed (was for HTML manipulation)
- All markdown processing dependencies - no markdown content anymore

---

## 🎯 **Success Criteria**

### Phase 1 Success (Core Migration - Raw JSON Display):

- ✅ All pages render correctly with PayloadCMS data
- ✅ API authentication with API key works correctly
- ✅ ISR with revalidation works (similar to current DatoCMS approach)
- ✅ Images display properly using Cloudflare R2 transformations
- ✅ Responsive images work with different sizes and formats
- ✅ **Raw JSON content displays** on post pages and about page
- ✅ SEO metadata (Open Graph + Twitter Cards) is correctly generated from Post_Meta
- ✅ Custom `renderMetaTags` function works properly
- ✅ Only published posts by quanghuy1242 (author ID=1) are shown on frontend
- ✅ **No sensitive User fields** (email, apiKey, auth fields) are exposed in queries
- ✅ Author avatar displays with placeholder fallback when null
- ✅ Similar posts feature works on post detail pages
- ✅ Pagination works correctly with new schema
- ✅ Filtering by category/tags works with new where clauses
- ✅ Tag structure (object array) is properly handled
- ✅ All tests pass and updated for new data structures
- ✅ No DatoCMS dependencies remain (`react-datocms` removed)
- ✅ Performance is equal or better than before
- ✅ Image loading performance is optimized with R2 transformations
- ✅ Security: No API keys or sensitive data exposed in client-side code

### Phase 2 Success (Final Polish - Lexical Rendering):

- ✅ Lexical content renders correctly on all post pages
- ✅ About page renders user bio content with Lexical
- ✅ Rich text features work properly (links, images, lists, headings)
- ✅ Custom Lexical nodes render correctly (if implemented)

---

## **Security Considerations**

### Critical Security Requirements

1. **User Data Protection**:

   - **NEVER query these sensitive User fields in public/client-side queries**:
     - `email`
     - `apiKey`, `apiKeyIndex`, `enableAPIKey`
     - `resetPasswordToken`, `resetPasswordExpiration`
     - `salt`, `hash`
     - `loginAttempts`, `lockUntil`
     - `sessions`
   - Only query safe fields:
     - `id`
     - `fullName`
     - `avatar` (Media reference)

2. **API Authentication**:

   - API key must be stored in environment variable: `GRAPHQL_API_KEY`
   - **NEVER expose API key in client-side code**
   - Use ISR/SSR only - all GraphQL queries run server-side
   - **Correct API key format**: `users API-Key {your-api-key}`
   - Add API key to request headers for ALL requests:

     ```typescript
     const headers = {
       Authorization: `users API-Key ${process.env.GRAPHQL_API_KEY}`,
     };

     // Example: GraphQL query
     await fetch(`${process.env.GRAPHQL_ENDPOINT_BASE_URL}/api/graphql`, {
       method: 'POST',
       headers,
       body: JSON.stringify({
         query: '{ Posts { docs { title } } }',
       }),
     });

     // Example: REST endpoint
     await fetch(`${process.env.GRAPHQL_ENDPOINT_BASE_URL}/api/posts`, {
       headers,
     });
     ```

3. **Query Filtering**:

   - Always filter for published posts: `_status: { equals: published }`
   - Always filter by author ID = 1 (quanghuy1242)
   - Prevent draft content exposure

4. **Image Security**:
   - R2 URLs may be public - ensure no sensitive data in filenames
   - Consider signed URLs for private content if needed

### Security Checklist Before Deployment

- [ ] Audit all GraphQL queries to ensure no sensitive User fields
- [ ] Verify API key is only in environment variables
- [ ] Test that draft posts are not accessible
- [ ] Verify ISR cache doesn't expose sensitive data
- [ ] Check that API key is not in any client-side bundles
- [ ] Test with browser DevTools network tab - no API keys visible
- [ ] Review all author/user-related queries and components

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
| Content migration complexity       | Medium | Low        | ✅ Manual migration process - no automated script needed              |
| Migration timeline overrun         | Medium | High       | Buffer time in estimate, prioritize features                          |
| API key exposure risk              | High   | Low        | ✅ Use env vars only, never expose in client code, test security      |
| Sensitive data leaks               | High   | Low        | ✅ Exclude all sensitive User fields from queries, audit carefully    |

---

**Document Version**: 2.0  
**Last Updated**: 2025-10-23  
**Status**: ✅ Ready for Implementation - All Questions Answered

**Key Decisions Made**:

- User ID for quanghuy1242: `1`
- GraphQL endpoint: `/api/graphql` (with base URL from env)
- Authentication: API key in env vars, ISR preferred
- User fields: Exclude sensitive fields (email, apiKey, etc.); Include bio for about page
- Avatar: Nullable Media field with public domain placeholder fallback
- Bio: Lexical JSON content for about page
- Display name: Use `fullName` directly
- Timestamps: Use `createdAt` and `updatedAt` (no separate `date` field)
- Content migration: Manual process (no markdown)
- No rate limits to worry about
