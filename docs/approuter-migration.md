It is still using the classic Pages Router. There is no `app/` directory yet; instead, global behaviour lives in `pages/_app.tsx` and `pages/_document.tsx`, and page components live under `pages/`. The current `_app.tsx` implements manual scroll‑restoration and calls Google Analytics on route change, while `_document.tsx` injects the GA script. Client state is managed via an `AppContext` reducer/ and a `useHomePosts` hook to cache posts and handle infinite scroll. The home page uses `getServerSideProps` and `useHomePosts`, and other pages use `getStaticProps`/`getStaticPaths` for data fetching. With this context, the migration plan can be updated as follows.

---

### 1  Create a root layout (`app/layout.tsx`)

- Add an `app/` folder. The root layout replaces `pages/_app.tsx` and `pages/_document.tsx`.
- Implement it as an **async server component** that returns `<html lang="en">` with nested `<body>`. Import the global stylesheet (`styles/index.css`).
- Copy the global favicon/manifest/meta tags currently rendered by `Metadata` into the `<head>` of the layout so these tags are always present.
- Migrate Google Analytics from `_document.tsx`. Rather than manually inserting a script in `_document.tsx` and calling `gtag.pageview()` in `_app.tsx`, use the official `@next/third‑party/google` integration. Remove the custom GA call in client code.
- Render the `Header` (see next step) inside the layout.
- Remove `pages/_app.tsx` and `pages/_document.tsx` once all pages are in `app/`.

### 2  Update the Header component

- The current `Header` imports `useAppContext` and reads a `header` value from context. In the App Router we want it to be a **pure server component**. Remove the `useAppContext` import and instead accept a `text` prop (or pull the header title directly from page data) and render it as now. Keep the `<Link>` navigation.
- Optionally relocate `components/core/header.tsx` under `app/components/` to make its server/client status obvious.

### 3  Remove client‑side global state

- Delete `context/state.tsx`, `context/actions.ts` and the `AppWrapper` provider. These exist only to remember the page header and cached posts; the App Router’s caching and scroll restoration remove the need for this.
- Remove `hooks/useHomePosts.ts`. Infinite scrolling and filter state will be handled by a client component (see step 5) using URL search params instead of a global store.
- Remove the scroll‑restoration and GA calls from `_app.tsx` since App Router handles back/forward navigation and scroll position automatically.

### 4  Home page (`app/page.tsx`)

- Replace `pages/index.tsx` with a server component in `app/page.tsx`. Its signature should be:

  ```ts
  export default async function Page({ searchParams }: { searchParams: { category?: string; tag?: string[]; page?: string; } }) { ... }
  ```

- Read `searchParams` to determine the active category and tags. Use `getCategoryIdBySlug()` and `getDataForHome()` to fetch posts and categories; pass `limit` (e.g., 5), `categoryId`, and `tags` to `getDataForHome`.

- Provide the first page of posts, categories and banner data as props to a **client** `InfinitePostList` component (see step 5). Keep the "Latest Posts" and categories sidebar layout.

- Implement `generateMetadata({ searchParams })` in this file. Use the existing `generateHomepageMetaTags` helper to build meta tags and convert them to Next’s metadata shape. Set the title and description based on the homepage data (`homepage.header` and `homepage.subHeader`) similar to how `pages/index.tsx` currently uses them.

### 5  Infinite‑scroll post list (`app/components/infinite-post-list.tsx`)

- Add a new client component (mark it with `"use client"`) that accepts `initialPosts`, `initialHasMore`, `category` and `tags` as props. The component should:

  - Store the current list of posts and pagination state in its own `useState`.
  - Fetch additional posts when the user scrolls near the bottom, using either the existing API route (`/api/posts`) or a new server action that wraps `getPaginatedPosts()`. Pass `limit`, `offset`, `category` and `tags` as query parameters or arguments.
  - Merge and deduplicate posts like the existing `mergePosts` function in `useHomePosts`.
  - Update the URL’s `page` search parameter using `router.replace()` with `{ scroll: false }` so back/forward navigation restores the scroll point.
  - Show loading and error states like the current infinite scroll code.

- This component replaces the functionality of the old `useHomePosts` hook and the intersection observer logic.

### 6  Post page (`app/posts/[slug]/page.tsx`)

- Convert the dynamic post page to a server component. Replace `pages/posts/[slug].tsx`.
- In `Page({ params })`, call `getDataForPostSlug(params.slug)` to fetch the post, related posts, and homepage header.
- Implement `generateStaticParams()` to generate a list of all post slugs for SSG. You can fetch all slugs using a GraphQL query or by paginating over `Posts` with `getPaginatedPosts`.
- Implement `generateMetadata({ params })` that calls `getDataForPostSlug(params.slug)` again (or reuses the data) and builds meta tags with `generatePostMetaTags`.
- Use `ResponsiveImage` or the existing `CoverImage` component rather than plain `<img>` for the post header. The current `post-header.tsx` uses raw images, whereas `CoverImage` wraps `ResponsiveImage` and already handles LQIP and responsive sizes. Updating this will provide consistent loading behaviour.

### 7  About page (`app/about/page.tsx`)

- Replace `pages/about.tsx` with an `async` server component. Call `getDataForAbout()` to fetch the author and homepage header (the current file does this in `getStaticProps`).
- Use `LexicalRenderer` to render the author’s bio.
- Implement `generateMetadata()` to set the page title to `About <author name>` and description accordingly, using `generateMetaTags` as in the old page.

### 8  Categories page (`app/categories/page.tsx`)

- The existing `pages/categories.tsx` just renders a “Not Yet Implemented” placeholder. Create a server component `app/categories/page.tsx`.
- Fetch all categories (you can write a small wrapper around `getDataForHome({ limit:0 })` or implement `getAllCategories()` that calls the `Categories` query). Pass the categories to the `Categories` component.
- Implement `generateMetadata()` with a title like “Categories” and a description such as “Browse all post categories”.

### 9  Convert/mark shared components

- **Categories component:** Currently a client component with `useState` and mouse‑over handlers. Convert it to a **server component**. Remove the `useState` hook; for hover effects, use Tailwind’s `group` and `group-hover` classes or pure CSS so no client JS is needed. Pass `categories` as a prop and render static `<Link>`s that set the `category` search param.
- **ResponsiveImage:** Keep as a **client component** (it uses state and an Intersection Observer). Add `"use client"` at the top of the file. Move it under `app/components/` if desired.
- **PostHeader:** Update to use `ResponsiveImage`/`CoverImage` for the banner image instead of `<img>` to get LQIP and responsive sizes automatically.

### 10  Handling API routes / server actions

- The existing `pages/api/posts.ts` exposes a paginated posts API. You have two options: 2. **Migrate to server actions:** Move the logic from `pages/api/posts.ts` into an exported async function in `app/actions.ts` that calls `getPaginatedPosts()`. Then call this action from the client component using the new `use server` syntax. Once server actions are used, you can delete the API route.

### 11  Clean‑up and final steps

- After migrating every page to the `app/` directory, remove the entire `pages/` directory except for `pages/api` (if you decide to retain the API route). Delete unused context files and the `useHomePosts` hook.
- Remove the manual scroll restoration code and GA calls in `_app.tsx`. Rely on the App Router’s built‑in cache and back/forward behaviour.

### 12 Notes

- All pages must be server side rendering, no pre built pages, so we want to have const dynamic = 'force-dynamic'; and server side may want to cache the actual graphql api calls, or even ISR is fine to revalidate the post detail every 1 hours, but the homepage and everything else should be force server and real data with some cache on the API.
- Make sure and trace down all the links works, especially the / to filter posts by tags and categories.
- Tests may fail, just remove them, don't try to fix it.
- Server Component is prefered to keep client javascript code at the zero at possible. So if there's any component you want to make it client, try to scope down and make the deepest nested component "use client".
- If there's any issue or concerns, garther all of thems and raise or at one, don't try to workaround and make assumptions.
