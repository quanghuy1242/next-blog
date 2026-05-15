# React Aria And daisyUI UI Migration Plan

> Status: implementation-grade research and migration proposal
>
> Date: 2026-05-15
>
> Scope:
>
> - `/home/quanghuy1242/pjs/next-blog`
> - `src/app/**`
> - `src/components/core/**`
> - `src/components/pages/**`
> - `src/components/shared/**`
> - `src/styles/index.css`
> - `tailwind.config.js`
> - `package.json`
>
> Source docs:
>
> - React Aria MCP, `getting-started`: reusable wrappers should compose React Aria parts and own the project API.
> - React Aria MCP, `styling`: components are unstyled, expose default class names, state data attributes, render props, and Tailwind state modifiers.
> - React Aria MCP, `frameworks`: Next.js App Router should keep server and client locale in sync through `lang`, `dir`, and `I18nProvider`.
> - React Aria MCP, `Button`: action buttons should use `onPress`; link-looking buttons should use the Link component, not button semantics.
> - React Aria MCP, `Link`: links support press events, disabled state, focus state, and custom router rendering.
> - React Aria MCP, `TextField`: text fields compose `TextField`, `Label`, `Input` or `TextArea`, description, and `FieldError`.
> - React Aria MCP, `Modal`: modal/drawer behavior should use `DialogTrigger`, `ModalOverlay`, `Modal`, and `Dialog`.
> - Context7 daisyUI `/saadeghi/daisyui`: Tailwind CSS 4 setup uses CSS `@plugin "daisyui"` and custom themes use `@plugin "daisyui/theme"`.
> - Context7 daisyUI `/saadeghi/daisyui`: semantic component classes include `btn`, `navbar`, `menu`, `card`, `badge`, `input`, `textarea`, `loading`, `progress`, `breadcrumbs`, `drawer`, `modal`, and `hero`.
>
> Related docs:
>
> - `docs/blog-ui-shared-style-plan.md`
> - `src/lib/README.md`
> - `src/lib/payload/README.md`
>
> Assumptions:
>
> - The first release should preserve the current visual identity, especially `blue: #416275` and `darkBlue: #3a5a6b`.
> - The migration should reduce raw Tailwind in page and route-family components, but it does not need to remove every utility class from layout wrappers.
> - Existing data-loading, Payload, comments, reading-progress, and auth behavior are not part of this migration except where UI wrappers touch them.
> - Package versions observed from npm on 2026-05-15: `react-aria-components@1.17.0`, `daisyui@5.5.19`, `tailwindcss-react-aria-components@2.1.0`, `tailwind-variants@3.2.2`, and `lucide-react@1.16.0`.

## Table Of Contents

- [1. Goal](#1-goal)
- [2. System Summary](#2-system-summary)
- [3. Current-State Findings](#3-current-state-findings)
  - [3.1 Package And Styling Setup](#31-package-and-styling-setup)
  - [3.2 App Shell And Layout](#32-app-shell-and-layout)
  - [3.3 Current Shared UI Layer](#33-current-shared-ui-layer)
  - [3.4 Page And Feature Surfaces](#34-page-and-feature-surfaces)
  - [3.5 Current Component Map](#35-current-component-map)
  - [3.6 Current Problems](#36-current-problems)
- [4. Target Model](#4-target-model)
  - [4.1 Layering](#41-layering)
  - [4.2 Styling Contract](#42-styling-contract)
  - [4.3 Layout Contract](#43-layout-contract)
  - [4.4 Component Selection Rule](#44-component-selection-rule)
  - [4.5 Proposed Directory Shape](#45-proposed-directory-shape)
- [5. Architecture Decisions](#5-architecture-decisions)
  - [5.1 Use React Aria Wrappers For Interactive Primitives](#51-use-react-aria-wrappers-for-interactive-primitives)
  - [5.2 Use daisyUI As Theme And Semantic Class Layer](#52-use-daisyui-as-theme-and-semantic-class-layer)
  - [5.3 Keep Layout Components Separate From Aria Wrappers](#53-keep-layout-components-separate-from-aria-wrappers)
  - [5.4 Rework Navigation Instead Of Porting It Literally](#54-rework-navigation-instead-of-porting-it-literally)
  - [5.5 Defer Non-Essential Widget Families](#55-defer-non-essential-widget-families)
- [6. Implementation Strategy](#6-implementation-strategy)
- [7. Detailed Implementation Plan](#7-detailed-implementation-plan)
  - [7.1 Foundation And Theme](#71-foundation-and-theme)
  - [7.2 Aria Primitive Wrappers](#72-aria-primitive-wrappers)
  - [7.3 Layout System](#73-layout-system)
  - [7.4 Navigation And App Chrome](#74-navigation-and-app-chrome)
  - [7.5 Forms And Comments](#75-forms-and-comments)
  - [7.6 Books And Reader Surfaces](#76-books-and-reader-surfaces)
  - [7.7 Posts, Categories, And Home](#77-posts-categories-and-home)
- [8. Migration And Rollout](#8-migration-and-rollout)
- [9. Edge Cases And Failure Modes](#9-edge-cases-and-failure-modes)
- [10. Implementation Backlog](#10-implementation-backlog)
  - [R1-A. Install And Wire Dependencies](#r1-a-install-and-wire-dependencies)
  - [R1-B. Define Blog daisyUI Theme](#r1-b-define-blog-daisyui-theme)
  - [R1-C. Build The First Aria Wrappers](#r1-c-build-the-first-aria-wrappers)
  - [R1-D. Introduce Page Layout Components](#r1-d-introduce-page-layout-components)
  - [R1-E. Rebuild Header And Navigation](#r1-e-rebuild-header-and-navigation)
  - [R1-F. Migrate Forms And Comments](#r1-f-migrate-forms-and-comments)
  - [R1-G. Migrate Books Reader Surfaces](#r1-g-migrate-books-reader-surfaces)
  - [R1-H. Migrate Home, Posts, And Taxonomy Surfaces](#r1-h-migrate-home-posts-and-taxonomy-surfaces)
  - [R1-I. Cleanup And Enforcement](#r1-i-cleanup-and-enforcement)
- [11. Future Backlog](#11-future-backlog)
- [12. Test And Verification Plan](#12-test-and-verification-plan)
- [13. Definition Of Done](#13-definition-of-done)
- [14. Final Model](#14-final-model)

## 1. Goal

Move the blog UI toward a maintainable component architecture where:

- React Aria Components own interactive behavior, state attributes, keyboard support, focus behavior, forms, overlays, and collection interactions.
- daisyUI owns the theme tokens and semantic visual recipes.
- Main route/page components mostly compose layout and feature components instead of carrying low-level HTML and dense Tailwind strings.
- The current brand identity remains recognizable through the existing blue theme colors and book/post imagery.

This document is a migration plan, not an implementation patch. It maps the current repo to the target model and splits the work into reviewable phases.

Non-goals for the first release:

- Replacing Payload data contracts.
- Reworking comments, reading-progress, bookmark, auth, or route-handler behavior except where UI components are touched.
- Introducing a full Storybook/design-system app.
- Converting Lexical-rendered article content into React Aria components. Rich content has its own rendering and CSS constraints.

## 2. System Summary

The app is a Next.js App Router blog with server-shaped page data and client islands for mutable or interactive state.

Observed route shape:

- `src/app/layout.tsx` loads root layout data through `getRootLayoutData()` and renders `Providers`.
- `src/app/providers.tsx` renders the global `Header`, analytics, scroll restoration, and route children.
- Page files such as `src/app/page.tsx`, `src/app/books/page.tsx`, `src/app/books/[slug]/page.tsx`, and `src/app/posts/[slug]/page.tsx` call server loaders from `src/lib/server/**`, then compose `Layout`, `Container`, and page components.
- Client route-family components live under `src/components/pages/**`, for example `HomePageClient`, `BooksPageClient`, `BookPageClient`, and `ChapterReaderClient`.
- Shared display and primitive components live under `src/components/shared/**`, including `shared/ui/button.tsx`, `shared/ui/form-control.tsx`, `shared/ui/panel.tsx`, `shared/ui/text-link.tsx`, `BookCover`, `BooksGrid`, `Posts`, `Categories`, and comments.

The architecture already has a useful separation between data loading and UI composition. The UI migration should preserve that separation and focus on the component and styling layers.

## 3. Current-State Findings

### 3.1 Package And Styling Setup

Observed files:

- `package.json`
- `tailwind.config.js`
- `src/styles/index.css`

Current dependencies include `next@16.2.6`, `react@19.2.5`, `tailwindcss@4.2.4`, `@tailwindcss/postcss@4.2.4`, and `classnames@2.5.1`.

Missing dependencies for the proposed architecture:

- `react-aria-components`
- `daisyui`
- `tailwindcss-react-aria-components`
- `tailwind-variants`
- `lucide-react`

Current Tailwind setup:

- `src/styles/index.css` imports Tailwind with:

```css
@config "../../tailwind.config.js";
@import 'tailwindcss';
```

- `tailwind.config.js` defines brand colors:

```js
blue: '#416275',
darkBlue: '#3a5a6b',
```

- `tailwind.config.js` has an empty `plugins` array.
- The configured `content` paths use root-level folders such as `./app`, `./components`, and `./hooks`, while this repo uses `src/app`, `src/components`, and `src/hooks`. Tailwind CSS 4 also has automatic source detection, but the daisyUI migration should make source detection explicit enough that component classes are not accidentally purged or missed.

Current global CSS:

- `src/styles/index.css` is mostly dedicated to `.lexical-content` rendering and embedded media/table/code styles.
- This is a good boundary. The migration should not turn `index.css` into a large custom component stylesheet.

### 3.2 App Shell And Layout

Observed files:

- `src/app/layout.tsx`
- `src/app/providers.tsx`
- `src/components/core/header.tsx`
- `src/components/core/layout.tsx`
- `src/components/core/container.tsx`

Current shell:

- `RootLayout` renders `<html lang="en">` and `<body>`.
- `Providers` renders `Header` and route children.
- `Layout` inserts a `DraftBanner`, a fixed-header spacer `<div className="mt-16" />`, and then a class-composed child wrapper.
- `Container` renders `<div className="container px-4">`.

Current header behavior:

- `Header` is a client component.
- It renders fixed top chrome with `bg-blue shadow-dark`, title link, and auth navigation.
- It probes `/api/auth/session` on mount, visibility change, and window focus.
- It keeps auth routes as hard navigations for signup, login, and logout.
- Navigation is implemented through local `HeaderTitle`, `Option`, and `OptionItem` helpers using `next/link` and plain `<a>`.

Current layout repetition:

- Common page shape appears repeatedly as `Layout className="flex flex-col items-center"` plus `Container className="my-4 w-full md:px-20"` plus `div className="mx-auto w-full md:w-2/3"`.
- `BooksPageClient`, `BookPage`, `CategoriesPage`, and `BooksShelfPage` use variants of this pattern.
- `ChapterReaderClient` owns its own responsive reader grid.
- `PostPage` has multiple `Container` blocks and local width wrappers.

### 3.3 Current Shared UI Layer

Observed files:

- `src/components/shared/ui/button.tsx`
- `src/components/shared/ui/form-control.tsx`
- `src/components/shared/ui/panel.tsx`
- `src/components/shared/ui/text-link.tsx`
- `src/components/shared/ui/loading-spinner.tsx`

Current primitives:

- `Button`, `ButtonLink`, `TextActionButton`, and `getButtonClassName` centralize button styling.
- `getInputClassName` and `FieldError` centralize input/error styling.
- `Panel` and `CenteredPanel` centralize bordered card surfaces.
- `TextLink` centralizes blue links.
- `LoadingSpinner` centralizes spinner markup.

These are a good starting point, but they are still custom native wrappers and class helpers. They do not use React Aria behavior, state props, render props, `onPress`, pending state, modal focus management, or TextField semantics.

### 3.4 Page And Feature Surfaces

Home:

- `src/app/page.tsx` composes `Layout` and `HomePageClient`.
- `src/components/pages/index/home-page-client.tsx` mixes high-level composition with layout utilities, infinite scroll loader state, retry state, category rail, books CTA, posts list, and side rail.
- `src/components/pages/index/banner.tsx` and `src/components/pages/posts/post-header.tsx` duplicate hero-style background image layout logic.

Books:

- `src/app/books/page.tsx` composes `BooksPageClient`.
- `BooksPageClient` mixes data hydration state, infinite scroll, viewer-state refresh, layout, empty/loading/error rendering, and `BooksGrid`.
- `BookPage` repeats the standard container and content-width wrapper before rendering `BookPageClient`.
- `BookPageClient` uses `BookmarkButton`, `ButtonLink`, inline badge markup, `BookHeader`, `ChapterList`, `LexicalRenderer`, and `CommentsSection`.
- `ChapterReaderClient` coordinates reader layout, TOC drawer/sidebar, password gate, reading progress, comments, and navigation.
- `ChapterTocDrawer` manually implements a fixed mobile dialog with `role="dialog"` and `aria-modal="true"` instead of using React Aria modal focus management.
- `ChapterPasswordGate` manually implements password visibility, label/input markup, custom SVG icons, button submit state, and a centered panel.

Posts and categories:

- `Posts`, `Post`, `PostTitle`, `Tags`, `Categories`, `CategoryCard`, and `CategoriesRail` use raw `next/link`, hand-coded grid/flex classes, hover/focus state, badges, and card overlays.
- `PostPage` contains several layout wrappers and comments composition.
- `CategoriesPage` repeats the standard content-width container pattern.

Comments:

- `CommentsSectionClient` uses a raw section heading, loading/error/empty paragraphs, and `CommentThread`.
- `CommentComposer` uses raw `<form>`, `<textarea>`, `getInputClassName`, and `Button`.
- `CommentItem` uses local pending moderation badge markup, local card markup, and `TextActionButton` for reply/edit/delete/confirm actions.

### 3.5 Current Component Map

| Current file or surface | Current role | Target owner | React Aria target | daisyUI target |
| --- | --- | --- | --- | --- |
| `src/components/shared/ui/button.tsx` | Button, link-button, text action helpers | `src/components/ui/aria/button.tsx` and `link.tsx` | `Button`, `Link`, `composeRenderProps`, `onPress`, `isPending` | `btn`, `btn-primary`, `btn-secondary`, `btn-ghost`, `btn-error`, `btn-sm`, `btn-lg` |
| `src/components/shared/ui/text-link.tsx` | Blue link wrapper | `src/components/ui/aria/link.tsx` | `Link`, custom render for Next links where needed | `link`, `link-hover`, `text-primary` |
| `src/components/shared/ui/form-control.tsx` | Input class helper and error text | `src/components/ui/aria/field.tsx`, `text-field.tsx` | `TextField`, `Label`, `Input`, `TextArea`, `FieldError`, `Text slot="description"` | `fieldset`, `label`, `input`, `textarea`, `validator-hint`, `input-error`, `textarea-error` |
| `src/components/shared/ui/panel.tsx` | Bordered surface | `src/components/ui/surface/panel.tsx` | None for static panels | `card`, `card-body`, `bg-base-100`, `border-base-300` |
| `src/components/shared/ui/loading-spinner.tsx` | Native spinner span | `src/components/ui/aria/progress.tsx` | `ProgressBar` for accessible loading where user-visible | `loading`, `loading-spinner`, `loading-sm` |
| `src/components/core/header.tsx` | Fixed top nav and auth links | `src/components/core/app-header.tsx` | `Link`, `Button`, possibly `Menu` for account/mobile nav | `navbar`, `menu`, `btn-ghost`, `bg-primary`, `text-primary-content` |
| `src/components/core/layout.tsx` | Main wrapper and draft banner spacer | `src/components/layout/page-shell.tsx` | None required | theme base classes, layout utilities |
| `src/components/core/container.tsx` | Width and padding | `src/components/layout/container.tsx` | None required | layout utilities, not component classes |
| `src/components/pages/index/banner.tsx` | Homepage hero | `src/components/layout/media-hero.tsx` or `src/components/shared/media-hero.tsx` | None required | `hero`, `hero-content` where useful |
| `src/components/pages/posts/post-header.tsx` | Post media hero | same media hero as home | None required | `hero` with project image overlay |
| `src/components/shared/tags.tsx` | Category/tag chips as links | `src/components/ui/aria/tag-link.tsx` or `src/components/shared/taxonomy/tag-list.tsx` | `Link`; future `TagGroup` if removable/selectable tags appear | `badge`, `badge-primary`, `badge-soft`, `badge-outline` |
| `src/components/shared/categories.tsx` | Category image cards | `src/components/shared/taxonomy/category-card.tsx` | `Link` for clickable cards | `card`, image overlay utilities |
| `src/components/shared/posts.tsx` | Post list and cards | `src/components/shared/posts/post-list.tsx` | `Link` | `card` only if card treatment remains desired |
| `src/components/shared/book-cover.tsx` | Cover image, bookmark/progress badges | `src/components/shared/books/book-cover.tsx` | `Link` | `badge`, `radial-progress` or `progress` only if design changes |
| `src/components/pages/books/chapter-list.tsx` | Chapter links list | `src/components/shared/books/chapter-list.tsx` or page feature | `ListBox` only if selectable; otherwise `Link` | `list`, `menu`, `badge`, `progress` |
| `src/components/pages/books/chapter-toc-drawer.tsx` | Manual mobile dialog | `src/components/ui/aria/modal.tsx` plus reader wrapper | `DialogTrigger`, `ModalOverlay`, `Modal`, `Dialog`, `Button` | `modal`, `modal-box`, `btn`, `menu` |
| `src/components/pages/books/chapter-password-gate.tsx` | Password form card | feature component using UI wrappers | `TextField`, `Input`, `Button`, possibly `Group` | `card`, `input`, `btn`, `alert` |
| `src/components/shared/comments/*` | Comment form/thread/actions | feature components using UI wrappers | `TextField`/`TextArea`, `Button`, optional `Disclosure` for reply/edit affordances | `card`, `textarea`, `badge-warning`, `btn-ghost`, `alert` |
| `src/components/shared/reading-progress-bar.tsx` | Text-only progress | `src/components/ui/aria/progress.tsx` wrapper | `ProgressBar` or `Meter` | `progress progress-primary` |
| `src/components/shared/draft-banner.tsx` | Preview banner | `src/components/core/draft-banner.tsx` | `Link` | `alert alert-warning` |

### 3.6 Current Problems

The current implementation works, but it has clear scaling costs:

- Interactive behavior is custom and inconsistent. Buttons use native `onClick`, links use `next/link`, drawers are manual dialogs, comment actions are text buttons, and password visibility is a raw button.
- Styling recipes are partially centralized but still heavily Tailwind-driven. Examples include `Header`, `Banner`, `PostHeader`, `CategoryCard`, `BookCover`, comments, chapter lists, and reader drawer markup.
- Page components still know too much about layout widths. `my-4 w-full md:px-20`, `mx-auto w-full md:w-2/3`, `max-w-3xl`, and grid wrappers appear across route and route-family components.
- The old shared UI primitives encode visual recipes but not accessibility behavior. They should become wrappers around React Aria components where React Aria has a matching primitive.
- Brand colors are Tailwind tokens but not daisyUI theme tokens. Once daisyUI is introduced, hardcoding `bg-blue`, `text-blue`, `hover:bg-darkBlue`, and gray/slate variants will compete with daisyUI semantic classes unless the theme maps them intentionally.
- Some visuals are duplicated as one-off components. `Banner` and `PostHeader` share a media-hero pattern. `Panel` and comment cards overlap with daisyUI card semantics. Tags and badges overlap with daisyUI badge semantics.
- Header/navigation is the main candidate for rethinking. The current header is a fixed bar with inline auth links. React Aria and daisyUI naturally support a more structured `navbar` plus links/buttons/menu model, especially for mobile and account actions.

## 4. Target Model

### 4.1 Layering

Recommended UI layers:

1. `src/app/**`: server data loading, metadata, route-level composition only.
2. `src/components/layout/**`: page shells, containers, content widths, media hero, reader layout, split layout, feed layout.
3. `src/components/core/**`: app chrome and app-level effects, including header, draft banner, analytics, scroll restoration, and providers.
4. `src/components/ui/aria/**`: React Aria wrappers styled with daisyUI classes.
5. `src/components/ui/surface/**`: static surfaces that React Aria does not provide, such as card/panel/media hero helpers.
6. `src/components/shared/<domain>/**`: reusable feature surfaces for books, posts, taxonomy, comments, and rich content.
7. `src/components/pages/<feature>/**`: route-family orchestration components that remain feature-specific.

This separates behavior primitives from layout primitives. React Aria wrappers should not own page width, and page layouts should not know button/input internals.

### 4.2 Styling Contract

Use daisyUI semantic classes first:

- Actions: `btn`, `btn-primary`, `btn-secondary`, `btn-ghost`, `btn-error`, `btn-sm`, `btn-lg`, `btn-square`, `btn-circle`.
- Links: `link`, `link-hover`, plus `text-primary` where the brand link color matters.
- Fields: `fieldset`, `label`, `input`, `textarea`, `input-error`, `textarea-error`.
- Surfaces: `card`, `card-body`, `alert`, `navbar`, `menu`, `badge`, `progress`, `loading`.
- Overlays: style React Aria `Modal` and `Dialog` with daisyUI `modal`, `modal-box`, and close buttons. Do not use daisyUI's checkbox-driven modal or drawer behavior.
- Heroes: use daisyUI `hero` and `hero-content` only for static hero layout. Keep image optimization and overlay logic in project components.

Use Tailwind utilities for layout and one-off composition:

- Grid columns, content max widths, responsive gaps, image aspect ratios, fixed/sticky placement, and media overlays can remain utilities.
- Repeated layout utilities should move into layout components instead of daisyUI theme variables.

Use daisyUI theme variables for repeated brand choices:

- Map `--color-primary` to the existing `#416275`.
- Map hover/darker intent through either a custom theme color or daisyUI component state where practical.
- Keep `--radius-field`, `--radius-box`, and `--border` aligned with the current restrained UI.
- Keep `--depth` conservative so daisyUI does not make the blog feel more dimensional than it does now.

### 4.3 Layout Contract

Add layout components so page components stop repeating raw width recipes:

- `PageShell`: owns `Layout`, fixed-header offset, draft banner, and default vertical spacing.
- `PageSection`: owns `Container`, vertical margin, and optional constrained inner width.
- `ContentColumn`: owns common `mx-auto w-full md:w-2/3`, `max-w-3xl`, and `max-w-4xl` variants.
- `FeedLayout`: owns the homepage `main + side rail` structure.
- `ReaderLayout`: owns the chapter reader grid and sticky TOC placement.
- `MediaHero`: owns full-width image hero, low-res blur image, overlay, title, subtext/meta slots.

Route files should mostly look like:

```tsx
return (
  <PageShell draftMode={data.isDraftMode}>
    <PageSection width="content">
      <BookPageClient ... />
    </PageSection>
  </PageShell>
);
```

Client route-family components may still own state machines, but not repeated page-frame markup.

### 4.4 Component Selection Rule

For each UI need:

1. If React Aria provides the interaction pattern, create or use a local wrapper under `src/components/ui/aria/**`.
2. Style the wrapper with daisyUI classes and small Tailwind layout utilities.
3. If the pattern is static display and React Aria does not provide a component, use daisyUI directly through a local wrapper or feature component.
4. If the pattern is content rendering from Payload/Lexical, keep it separate and style through rich-content CSS.

Examples:

- Use React Aria `Button` for action buttons.
- Use React Aria `Link` or a wrapper that renders Next links for navigation links.
- Use React Aria `TextField`, `Input`, `TextArea`, `Label`, and `FieldError` for comment and password forms.
- Use React Aria `Modal`/`Dialog` for the chapter TOC drawer.
- Use React Aria `Menu` for future account/mobile menus.
- Use daisyUI `hero` for static hero layout because React Aria does not provide a hero component.
- Use daisyUI `card` and `badge` for static cards and badges, but keep clickable cards as accessible links.

### 4.5 Proposed Directory Shape

Recommended first-release shape:

```text
src/components/
  core/
    app-header.tsx
    draft-banner.tsx
    effects/
  layout/
    content-column.tsx
    feed-layout.tsx
    media-hero.tsx
    page-section.tsx
    page-shell.tsx
    reader-layout.tsx
  ui/
    aria/
      button.tsx
      link.tsx
      modal.tsx
      progress.tsx
      text-field.tsx
    surface/
      card.tsx
      status.tsx
  shared/
    books/
    comments/
    posts/
    taxonomy/
    rich-content/
```

Migration can keep compatibility exports from current paths for one phase:

- `src/components/shared/ui/button.tsx` can re-export from `src/components/ui/aria/button.tsx`.
- `src/components/shared/ui/text-link.tsx` can re-export from `src/components/ui/aria/link.tsx`.
- `src/components/shared/ui/form-control.tsx` can either re-export compatibility helpers or be deleted after consumers move.

Do not keep compatibility exports indefinitely. They should be removed in cleanup once imports are updated.

## 5. Architecture Decisions

### 5.1 Use React Aria Wrappers For Interactive Primitives

Recommended:

- Build local wrapper components rather than importing React Aria directly into pages.
- Preserve project-specific APIs such as `variant`, `size`, `fullWidth`, `hardNavigate`, and `prefetch`, but map them to React Aria semantics.
- Use React Aria state data attributes or render props for styling states.
- Prefer `onPress` in wrappers and feature code for button actions.

Reasoning:

- React Aria provides the behavior surface the current custom primitives lack.
- Wrappers keep pages stable if React Aria APIs or daisyUI class decisions change.
- This follows React Aria's documented model: assemble parts, add styles, then create reusable components.

Rejected:

- Importing React Aria components directly in route/page components. This would move the low-level composition problem from HTML/Tailwind to React Aria part wiring.

### 5.2 Use daisyUI As Theme And Semantic Class Layer

Recommended:

- Add daisyUI through CSS `@plugin` because this repo uses Tailwind CSS 4.
- Create a custom `birdless` theme in `src/styles/index.css` or a dedicated imported CSS file.
- Map the current brand colors into daisyUI's semantic variables.
- Use daisyUI classes inside wrapper implementations, not as ad hoc class strings scattered through pages.

Reasoning:

- daisyUI gives maintainable semantic classes without abandoning Tailwind.
- Theme tokens make `primary`, `base`, `neutral`, `warning`, and `error` consistent across buttons, badges, cards, alerts, and fields.
- The blog can keep its muted blue identity while using semantic classes.

Rejected:

- Keeping only Tailwind config tokens and not adopting daisyUI theme variables. This would not solve the mismatch once daisyUI components are used.
- Using daisyUI behavior patterns that depend on checkbox hacks for drawers/modals. React Aria should own overlay behavior.

### 5.3 Keep Layout Components Separate From Aria Wrappers

Recommended:

- Create layout components under `src/components/layout`.
- Keep React Aria wrappers focused on individual controls and interaction patterns.
- Move repeated content-width and feed/reader layout classes out of pages.

Reasoning:

- React Aria does not solve page layout.
- daisyUI provides some layout components, but the repo has domain-specific layouts: homepage feed plus rail, reader grid plus TOC, post hero plus article content, and book content columns.
- Separating layout avoids bloated UI primitives and keeps route files simple.

### 5.4 Rework Navigation Instead Of Porting It Literally

Recommended:

- Rebuild `Header` as `AppHeader` with daisyUI `navbar` styling and React Aria `Link`/`Button` wrappers.
- Keep current auth probing and hard-navigation requirements.
- Add a mobile/account menu only if the current inline links become cramped. If added, use React Aria `Menu`, not daisyUI dropdown behavior alone.
- Preserve hidden About behavior unless product navigation changes.

Reasoning:

- The header is the highest-visibility mismatch and it is currently custom.
- React Aria and daisyUI naturally support a semantic nav plus button/menu model.
- Porting `Option`/`OptionItem` as-is would miss the chance to fix keyboard and responsive behavior.

### 5.5 Defer Non-Essential Widget Families

Deferred:

- `Select`, `ComboBox`, `Tabs`, `Table`, `Calendar`, and `Tree`.
- Storybook starter kit.
- Full dark-mode theme.
- Command palette or search autocomplete.

Reasoning:

- The current blog does not have selects, date pickers, tabs, tables as app controls, or tree navigation in the main UI.
- Adding wrappers before they have real consumers increases surface area and future cleanup.

## 6. Implementation Strategy

Use a staged migration with compatibility bridges:

1. Add dependencies, daisyUI theme, and React Aria provider setup.
2. Build first wrappers while preserving current public component names.
3. Move layout repetition into layout components.
4. Rebuild the header/app chrome.
5. Migrate forms, comments, and drawer/dialog behavior.
6. Migrate display surfaces to daisyUI cards/badges/progress where it improves consistency.
7. Remove compatibility helpers and enforce import boundaries.

Each phase should keep the app shippable. Avoid converting every component in one patch.

Rollback:

- Dependency/theme setup can be rolled back by removing CSS `@plugin` lines and packages.
- Wrapper migration can roll back one primitive at a time if compatibility exports are kept for the first phase.
- Header and drawer changes should be tested independently because they touch global navigation and overlay behavior.

## 7. Detailed Implementation Plan

### 7.1 Foundation And Theme

Current problem:

- `react-aria-components` and daisyUI are not installed.
- `blue` and `darkBlue` live only in Tailwind config.
- `src/styles/index.css` imports Tailwind but does not register daisyUI or React Aria state variants.

Target behavior:

- Tailwind CSS 4 loads daisyUI and React Aria Tailwind state modifiers.
- The app has a default daisyUI theme named `birdless`.
- Brand colors map to daisyUI semantic variables.

Implementation tasks:

- Add runtime dependencies:

```bash
pnpm add react-aria-components tailwind-variants lucide-react
```

- Add styling dependencies:

```bash
pnpm add -D daisyui tailwindcss-react-aria-components
```

- Update `src/styles/index.css` near the top:

```css
@config "../../tailwind.config.js";
@import 'tailwindcss';
@plugin "daisyui";
@plugin "tailwindcss-react-aria-components";
@plugin "daisyui/theme" {
  name: "birdless";
  default: true;
  prefersdark: false;
  color-scheme: light;

  --color-primary: #416275;
  --color-primary-content: #ffffff;
  --color-secondary: #3a5a6b;
  --color-secondary-content: #ffffff;
  --color-accent: #79ffe1;
  --color-accent-content: #102027;
  --color-neutral: #333333;
  --color-neutral-content: #ffffff;
  --color-base-100: #ffffff;
  --color-base-200: #fafafa;
  --color-base-300: #eaeaea;
  --color-base-content: #1f2937;
  --color-info: #0070f3;
  --color-info-content: #ffffff;
  --color-success: #0f766e;
  --color-success-content: #ffffff;
  --color-warning: #f59e0b;
  --color-warning-content: #111827;
  --color-error: #dc2626;
  --color-error-content: #ffffff;
  --radius-selector: 9999px;
  --radius-field: 0.25rem;
  --radius-box: 0.5rem;
  --size-selector: 0.25rem;
  --size-field: 0.25rem;
  --border: 1px;
  --depth: 0;
  --noise: 0;
}
```

- Add `data-theme="birdless"` to `<html>` in `src/app/layout.tsx`.
- Add `I18nProvider` through a small client provider. Since `src/app/providers.tsx` currently renders both server-compatible composition and client components, prefer:
  - `src/app/aria-provider.tsx` with `'use client'` and `I18nProvider locale="en-US"`.
  - Wrap children in `Providers`.
- Keep `<html lang="en">` for the first release. If multi-locale support is added later, follow React Aria's Next.js guidance and derive `lang`/`dir` from request headers.

Tests:

- `pnpm lint`
- `pnpm build`
- Manual smoke of homepage and one book page to confirm daisyUI did not alter typography or rich content unexpectedly.

### 7.2 Aria Primitive Wrappers

Current problem:

- Current primitives are native wrappers with project classes.
- Feature code still uses raw HTML for forms, links, modals, badges, and progress.

Target behavior:

- Consumers import stable local components.
- Internals use React Aria where applicable.
- Styling uses daisyUI semantic classes and React Aria state modifiers.

Implementation tasks:

- Create `src/components/ui/aria/button.tsx`:
  - Wrap `react-aria-components/Button`.
  - Support `variant="primary" | "secondary" | "ghost" | "danger"`.
  - Support `size="sm" | "md" | "lg" | "icon"`.
  - Support `fullWidth`.
  - Support `isPending`, using daisyUI `loading loading-spinner` and preserving accessible pending text.
  - Use `btn`, `btn-primary`, `btn-secondary`, `btn-ghost`, `btn-error`, `btn-sm`, `btn-lg`, and `w-full`.
- Create `src/components/ui/aria/link.tsx`:
  - Wrap React Aria `Link`.
  - Provide `TextLink` and `ButtonLink` exports.
  - For Next internal links, use React Aria `render` to render a compatible anchor/Next Link pattern, or preserve `next/link` inside the wrapper while using React Aria semantics where practical.
  - Keep `hardNavigate` for auth routes.
  - Keep `prefetch={false}` support for viewer-sensitive book/chapter links.
- Create `src/components/ui/aria/text-field.tsx`:
  - Wrap `TextField`, `Label`, `Input`, `TextArea`, `FieldError`, and optional description.
  - Support `isInvalid`, `errorMessage`, `textarea`, `rows`, `maxLength`, `type`, `autoComplete`, `placeholder`, and adornment slots for password icons.
  - Use daisyUI `fieldset`, `label`, `input`, `textarea`, `input-error`, `textarea-error`.
- Create `src/components/ui/aria/modal.tsx`:
  - Wrap `DialogTrigger`, `ModalOverlay`, `Modal`, `Dialog`, and close button.
  - Style with daisyUI `modal`, `modal-open`, `modal-box`, `modal-backdrop` equivalents through React Aria state.
  - Use render props/data states for entering/exiting animation if animation is preserved.
- Create `src/components/ui/aria/progress.tsx`:
  - Use React Aria `ProgressBar` for determinate and indeterminate loading.
  - Style with daisyUI `progress progress-primary` and `loading loading-spinner`.
- Keep temporary re-exports from existing `src/components/shared/ui/*` paths.

Tests:

- Add or update component tests for button disabled/pending state, links, text field error rendering, and modal close behavior.
- Existing tests likely touched: `tests/components/chapter-password-gate.test.tsx`, `tests/components/comment-item.test.tsx`, `tests/components/header.test.tsx`.

### 7.3 Layout System

Current problem:

- Route and client components repeat page shell and width classes.
- `Layout` does not encode named layout variants.

Target behavior:

- Page files compose named layout components.
- Feature components focus on feature state and feature rendering.

Implementation tasks:

- Add `src/components/layout/page-shell.tsx`:
  - Encapsulate current `Layout` behavior.
  - Accept `isDraftMode`, `draftExitHref`, `className`, and children.
  - Preserve fixed header offset until header behavior changes.
- Add `src/components/layout/page-section.tsx`:
  - Encapsulate `Container className="my-4 w-full md:px-20"`.
  - Support `width="full" | "content" | "article" | "wide"`.
- Add `src/components/layout/content-column.tsx`:
  - Encapsulate `mx-auto w-full md:w-2/3`, `max-w-3xl`, `max-w-4xl`.
- Add `src/components/layout/feed-layout.tsx`:
  - Own homepage responsive feed plus sidebar structure.
- Add `src/components/layout/reader-layout.tsx`:
  - Own chapter reader grid, sticky TOC slot, article slot, and drawer slot.
- Add `src/components/layout/media-hero.tsx`:
  - Deduplicate `Banner` and `PostHeader` image hero structure.
  - Keep low-res blur image support and image overlay.
  - Use daisyUI `hero` only as a semantic styling helper, not as a replacement for media handling.

Tests:

- Component tests for `MediaHero` fallback behavior and alt text.
- Update route/page tests if snapshots or role queries depend on old wrappers.

### 7.4 Navigation And App Chrome

Current problem:

- `Header` is hand-coded, fixed, and not based on the target component strategy.
- Navigation links are inline spans with border hovers.
- Auth probing is mixed with rendering.

Target behavior:

- `AppHeader` composes stable nav primitives.
- Auth state behavior remains intact.
- daisyUI theme controls header color through `bg-primary text-primary-content`.

Implementation tasks:

- Rename or replace `src/components/core/header.tsx` with `src/components/core/app-header.tsx`.
- Extract `useHeaderAuthState` or `useAppHeaderAuthState` in the same file or `src/hooks/auth/useHeaderAuthState.ts` only if reused.
- Render:
  - `nav` or React Aria-compatible landmark with `aria-label="Primary"`.
  - Brand link using `TextLink` or header-specific link wrapper.
  - Auth actions using `ButtonLink` or `Menu` if converted to account menu.
- Use daisyUI:
  - `navbar fixed top-0 z-50 min-h-16 bg-primary text-primary-content shadow-sm`
  - `btn btn-ghost`
  - `menu menu-horizontal`
- Keep hard navigation for:
  - `/auth/signup?...`
  - `/auth/login?...`
  - `/auth/logout?...`
- Keep Bookshelf visible only when authenticated.
- Keep About hidden unless a product decision changes it.

Tests:

- Update `tests/components/header.test.tsx`.
- Manual keyboard checks:
  - Tab reaches brand, Bookshelf, Logout, Sign up, and Sign in when applicable.
  - Focus ring is visible.
  - Hard navigation links still render real `href` attributes.

### 7.5 Forms And Comments

Current problem:

- `CommentComposer` and `ChapterPasswordGate` use raw fields and custom label/error handling.
- Comment cards and moderation badges use local Tailwind recipes.

Target behavior:

- Form fields use React Aria `TextField` wrappers.
- Comments use daisyUI `card`, `badge`, and button classes through local wrappers.

Implementation tasks:

- Convert `CommentComposer`:
  - Replace raw `<textarea>` with `TextAreaField`.
  - Keep controlled `content`, max length, disabled/submitting behavior.
  - Use `Button isPending={submitting}` or keep explicit submit label if the wrapper supports it.
  - Keep character count.
- Convert `CommentItem`:
  - Replace pending badge with a shared `Badge` or daisyUI `badge badge-warning badge-soft`.
  - Replace comment card with `Card` surface.
  - Replace reply/edit/delete text buttons with `Button variant="ghost" size="sm"` or a specific `ActionLinkButton` wrapper.
  - Consider React Aria `Disclosure` for reply form expansion only if it improves semantics without complicating state.
- Convert `CommentsSectionClient`:
  - Use `StatusText` or `Alert` surface for loading/error/empty.
  - Keep data and mutation behavior unchanged.
- Convert `ChapterPasswordGate`:
  - Replace native password input with `TextField` wrapper.
  - Replace hand-coded SVG icons with `lucide-react` icons such as `Lock`, `Eye`, and `EyeOff`.
  - Keep password visibility button as React Aria `Button` with `variant="ghost"` and `size="icon"`.

Tests:

- Existing component tests for password gate and comment item/composer should pass after updates.
- Add keyboard/focus tests where practical:
  - Password field receives label.
  - Show/hide password button has the correct accessible name.
  - Reply/edit/delete actions are buttons and remain disabled during submit.

### 7.6 Books And Reader Surfaces

Current problem:

- Reader drawer manually implements modal behavior.
- Reading progress is text-only.
- Book cover badges, chapter lock badge, and chapter rows use custom badge/panel/link recipes.

Target behavior:

- Reader overlay behavior uses React Aria modal/dialog.
- Book badges and progress use daisyUI semantic components where appropriate.
- Reader layout is a named layout component.

Implementation tasks:

- Convert `ChapterTocDrawer`:
  - Use local `Modal`/`Dialog` wrapper.
  - Preserve bottom-sheet visual treatment on mobile.
  - Ensure Escape closes the drawer.
  - Ensure focus is trapped while open and restored to the trigger after close.
- Convert `ChapterReaderHeader`:
  - Use `Breadcrumbs` from React Aria if breadcrumbs remain interactive and more than decorative.
  - Use `Button` wrapper for TOC trigger.
  - Keep `BookmarkButton`.
- Convert `ChapterToc` and `ChapterList`:
  - Keep as links unless they become selectable widgets.
  - Use `TextLink`, daisyUI `menu`, `badge`, and `progress` classes.
  - Do not use `ListBox` unless selection state is introduced.
- Convert `ReadingProgressBar`:
  - Use React Aria `ProgressBar` if progress is visible as a bar.
  - If the product wants text-only progress, rename to `ReadingProgressText` and do not force a component mismatch.
- Convert `BookCover` indicators:
  - Use a local `Badge` wrapper styled by daisyUI.
  - Keep absolute placement local to `BookCover`.

Tests:

- `tests/components/chapter-toc-drawer.test.tsx`
- `tests/components/chapter-toc.test.tsx`
- `tests/components/chapter-list.test.tsx`
- `tests/components/book-item.test.tsx`
- Reader manual smoke on mobile width and desktop width.

### 7.7 Posts, Categories, And Home

Current problem:

- `Banner` and `PostHeader` duplicate media hero logic.
- `Posts`, `Tags`, and `Categories` use raw links, badges, cards, and hover states.
- `HomePageClient` owns feed layout classes.

Target behavior:

- Static display components use daisyUI semantic styling through local wrappers.
- Clickable items still use accessible links.
- Homepage layout is owned by `FeedLayout`.

Implementation tasks:

- Replace `Banner` and `PostHeader` with `MediaHero`.
- Convert `Tag`/`Tags`:
  - Use React Aria Link wrapper.
  - Style as daisyUI `badge`.
  - Preserve query object support and `prefetch={false}` where needed.
- Convert `Posts`:
  - Split into `PostList` and `PostCard`.
  - Keep `CoverImage` and `Date`.
  - Use `TextLink` for titles.
  - Use `TagList`.
- Convert `Categories`:
  - Keep `CategoryCard` as a project card because it has image overlay behavior.
  - Use daisyUI `card` base classes for static shape if it does not fight the overlay.
  - Replace manual hover/focus state with React Aria Link data attributes where practical.
- Convert `HomePageClient`:
  - Move feed/sidebar layout into `FeedLayout`.
  - Use shared `LoadMoreSentinel`, `LoadingState`, `EmptyState`, and `ErrorState` surfaces if these repeat with `BooksPageClient`.

Tests:

- `tests/components/banner.test.tsx`
- `tests/components/posts.test.tsx`
- `tests/components/categories.test.tsx`
- `tests/components/categories-rail.test.tsx`
- `tests/hooks/useHomePosts.test.tsx` should remain unaffected.

## 8. Migration And Rollout

Recommended rollout:

1. Foundation PR:
   - Install dependencies.
   - Add daisyUI theme.
   - Add React Aria provider.
   - Add wrapper files with no consumer migration except compatibility tests.
2. Low-risk primitive migration PR:
   - Replace current `shared/ui` internals with React Aria wrappers.
   - Keep exports stable.
   - Migrate `Button`, `ButtonLink`, `TextLink`, `LoadingSpinner`, and field helpers.
3. Layout PR:
   - Add layout components.
   - Migrate `BookPage`, `BooksPage`, `CategoriesPage`, `AboutPage`, and `PostPage` page-frame wrappers.
4. Header PR:
   - Rebuild app header using new wrappers and daisyUI navbar styling.
   - Keep auth behavior identical.
5. Forms and comments PR:
   - Migrate comment composer/item/section.
   - Migrate password gate.
6. Reader overlay PR:
   - Replace manual TOC drawer with React Aria modal/dialog wrapper.
7. Display surface PRs:
   - Migrate badges, tags, cards, hero, posts, categories, book cover indicators, and progress.
8. Cleanup PR:
   - Remove compatibility exports.
   - Update import boundaries.
   - Add lint/documentation guardrails.

Deployment:

- No data migration is required.
- No environment variable change is required.
- Build should be validated because Tailwind plugin changes can alter generated CSS.
- Visual regression should be checked manually across homepage, post detail, books list, book detail, chapter reader, locked chapter, comments, and auth fallback.

## 9. Edge Cases And Failure Modes

- Tailwind/daisyUI class generation misses `src/**`: update Tailwind source configuration or CSS `@source` usage so daisyUI and project classes generate reliably.
- daisyUI defaults change the visual identity too much: reduce `--depth`, tune radii, and keep `primary` mapped to `#416275`.
- React Aria provider locale mismatches server `lang`: keep `lang="en"` and `I18nProvider locale="en-US"` for first release; if dynamic locale is added, set both from the same request-derived value.
- Auth header hard navigations become client transitions: keep `hardNavigate` on auth URLs and verify rendered anchors.
- Next Link integration with React Aria Link loses prefetch control: preserve `prefetch` in the local wrapper and explicitly test book/chapter links that require `prefetch={false}`.
- Modal drawer changes break scroll or focus restoration: use React Aria modal primitives, test Escape/outside close behavior, and verify focus returns to the TOC trigger.
- Pending button state hides accessible labels: follow React Aria pending guidance and keep spinner/label accessible.
- Rich text styles are accidentally overridden by daisyUI base styles: keep `.lexical-content` CSS explicit and smoke test post/chapter content.
- daisyUI `card` spacing conflicts with dense comment layout: wrap it locally and tune `card-body` padding with small utilities.
- Button variants no longer match old sizes: keep compatibility size names until all consumers migrate, then decide whether to adopt daisyUI names directly.

## 10. Implementation Backlog

### R1-A. Install And Wire Dependencies

Scope:

- `package.json`
- `pnpm-lock.yaml`
- `src/app/layout.tsx`
- `src/app/providers.tsx`
- `src/app/aria-provider.tsx`
- `src/styles/index.css`

Tasks:

- [ ] Install `react-aria-components`, `tailwind-variants`, and `lucide-react`.
- [ ] Install `daisyui` and `tailwindcss-react-aria-components`.
- [ ] Add `@plugin "daisyui"` and `@plugin "tailwindcss-react-aria-components"` to Tailwind CSS entrypoint.
- [ ] Add `data-theme="birdless"` to the root HTML element.
- [ ] Add a client `I18nProvider` wrapper with `locale="en-US"`.

Acceptance criteria:

- The app builds CSS with daisyUI classes.
- Existing pages still render with current brand color.
- No route behavior changes.

Tests:

- `pnpm lint`
- `pnpm build`

### R1-B. Define Blog daisyUI Theme

Scope:

- `src/styles/index.css`
- `tailwind.config.js`

Tasks:

- [ ] Define `birdless` daisyUI theme variables.
- [ ] Map `primary` to `#416275`.
- [ ] Map `secondary` or a supporting token to `#3a5a6b`.
- [ ] Keep `base-100`, `base-200`, `base-300`, and `base-content` compatible with current white/gray surfaces.
- [ ] Decide whether `blue` and `darkBlue` stay in Tailwind config as compatibility aliases through the migration.

Acceptance criteria:

- `btn btn-primary`, `bg-primary`, `text-primary`, `badge-primary`, and `progress-primary` all use the existing blog blue identity.
- Existing `.lexical-content` styling remains readable.

Tests:

- `pnpm build`
- Manual smoke on post detail and chapter reader rich content.

### R1-C. Build The First Aria Wrappers

Scope:

- `src/components/ui/aria/button.tsx`
- `src/components/ui/aria/link.tsx`
- `src/components/ui/aria/text-field.tsx`
- `src/components/ui/aria/progress.tsx`
- `src/components/shared/ui/button.tsx`
- `src/components/shared/ui/text-link.tsx`
- `src/components/shared/ui/form-control.tsx`
- `src/components/shared/ui/loading-spinner.tsx`

Tasks:

- [ ] Implement React Aria button wrapper with daisyUI variants.
- [ ] Implement link/text-link/button-link wrappers.
- [ ] Implement text field and text area wrappers.
- [ ] Implement loading/progress wrappers.
- [ ] Keep compatibility exports for current import paths.

Acceptance criteria:

- Existing consumers compile without changing all imports at once.
- Disabled, pending, focus-visible, pressed, and invalid states have visible styling.

Tests:

- `pnpm lint`
- Add/update component tests for wrappers.

### R1-D. Introduce Page Layout Components

Scope:

- `src/components/layout/page-shell.tsx`
- `src/components/layout/page-section.tsx`
- `src/components/layout/content-column.tsx`
- `src/components/layout/feed-layout.tsx`
- `src/components/layout/reader-layout.tsx`
- `src/components/layout/media-hero.tsx`
- `src/app/**/*.tsx`
- `src/components/pages/**/*.tsx`

Tasks:

- [ ] Add named layout components.
- [ ] Migrate repeated `Layout + Container + content width` patterns.
- [ ] Deduplicate `Banner` and `PostHeader` into `MediaHero`.
- [ ] Keep feature state in existing page-client components.

Acceptance criteria:

- Route files contain mostly data loading, metadata, and component composition.
- Repeated content-width recipes are no longer scattered across page files.

Tests:

- `pnpm lint`
- `tests/components/banner.test.tsx`
- Manual smoke of home, post detail, books list, book detail, categories, and about.

### R1-E. Rebuild Header And Navigation

Scope:

- `src/components/core/header.tsx`
- `src/components/core/app-header.tsx`
- `src/app/providers.tsx`
- `tests/components/header.test.tsx`

Tasks:

- [ ] Replace local header helpers with `AppHeader`.
- [ ] Use React Aria/daisyUI link and button wrappers.
- [ ] Preserve auth session probing and returnTo behavior.
- [ ] Preserve hard navigation for auth URLs.
- [ ] Verify mobile behavior and decide whether a React Aria `Menu` is needed.

Acceptance criteria:

- Header visual identity remains blog-blue.
- Auth links still match current authenticated/anonymous states.
- Keyboard focus order is logical and visible.

Tests:

- `pnpm lint`
- `tests/components/header.test.tsx`
- Manual auth-link smoke.

### R1-F. Migrate Forms And Comments

Scope:

- `src/components/shared/comments/CommentComposer.tsx`
- `src/components/shared/comments/CommentItem.tsx`
- `src/components/shared/comments/comments-section-client.tsx`
- `src/components/pages/books/chapter-password-gate.tsx`
- `tests/components/comment-item.test.tsx`
- `tests/components/chapter-password-gate.test.tsx`

Tasks:

- [ ] Convert comment textarea to `TextAreaField`.
- [ ] Convert password input to `TextField` wrapper.
- [ ] Replace manual icons with `lucide-react`.
- [ ] Replace moderation badge with daisyUI badge styling.
- [ ] Replace comment cards/statuses with shared surfaces.

Acceptance criteria:

- Form labels and errors are accessible.
- Submit/pending/disabled behavior is preserved.
- Comment edit/reply/delete behavior is unchanged.

Tests:

- `pnpm lint`
- `tests/components/comment-item.test.tsx`
- `tests/components/chapter-password-gate.test.tsx`
- `tests/hooks/useComments.test.tsx`

### R1-G. Migrate Books Reader Surfaces

Scope:

- `src/components/pages/books/chapter-toc-drawer.tsx`
- `src/components/pages/books/chapter-reader-client.tsx`
- `src/components/pages/books/chapter-reader-header.tsx`
- `src/components/pages/books/chapter-list.tsx`
- `src/components/pages/books/chapter-toc.tsx`
- `src/components/shared/book-cover.tsx`
- `src/components/shared/reading-progress-bar.tsx`

Tasks:

- [ ] Replace manual drawer with React Aria modal/dialog wrapper.
- [ ] Move reader grid into `ReaderLayout`.
- [ ] Convert chapter links and lock/progress indicators to wrapper/daisyUI classes.
- [ ] Convert book cover bookmark/progress badges.
- [ ] Decide whether progress remains text or becomes a React Aria progress bar.

Acceptance criteria:

- Mobile TOC has correct modal focus behavior.
- Desktop TOC remains sticky and usable.
- Book/chapter links preserve `prefetch={false}` where currently required.

Tests:

- `pnpm lint`
- `tests/components/chapter-toc-drawer.test.tsx`
- `tests/components/chapter-toc.test.tsx`
- `tests/components/chapter-list.test.tsx`
- `tests/components/book-item.test.tsx`
- Manual locked and unlocked chapter smoke.

### R1-H. Migrate Home, Posts, And Taxonomy Surfaces

Scope:

- `src/components/pages/index/home-page-client.tsx`
- `src/components/pages/index/banner.tsx`
- `src/components/pages/posts/post-header.tsx`
- `src/components/shared/posts.tsx`
- `src/components/shared/tags.tsx`
- `src/components/shared/categories.tsx`
- `src/components/shared/categories-rail.tsx`

Tasks:

- [ ] Use `FeedLayout` in `HomePageClient`.
- [ ] Replace banner/post header with `MediaHero`.
- [ ] Convert tags to link-backed daisyUI badges.
- [ ] Split `Posts` into list/card pieces.
- [ ] Keep category image-card overlay behavior but align base classes with `card`.

Acceptance criteria:

- Homepage desktop/mobile layout remains equivalent.
- Post/category filters still produce the same query URLs.
- Tags and category links remain keyboard accessible.

Tests:

- `pnpm lint`
- `tests/components/posts.test.tsx`
- `tests/components/categories.test.tsx`
- `tests/components/categories-rail.test.tsx`
- `tests/components/banner.test.tsx`
- `tests/hooks/useHomePosts.test.tsx`

### R1-I. Cleanup And Enforcement

Scope:

- `src/components/shared/ui/**`
- `src/components/**/*.tsx`
- `src/app/**/*.tsx`
- Documentation under `docs/**`

Tasks:

- [ ] Remove compatibility exports once imports are migrated.
- [ ] Update local docs to describe `components/ui/aria`, `components/layout`, and shared domain surfaces.
- [ ] Search for repeated raw recipes:
  - `bg-blue`
  - `hover:bg-darkBlue`
  - `rounded border border-gray`
  - `focus:border-blue`
  - `animate-spin`
  - `role="dialog"`
- [ ] Replace repeated raw recipes with wrappers or justify local exceptions.

Acceptance criteria:

- Main/page components mostly compose higher-level components.
- Raw Tailwind in pages is limited to local layout composition.
- Interactive controls use React Aria wrappers unless explicitly documented otherwise.

Tests:

- `pnpm lint`
- `pnpm test`
- `pnpm build`

## 11. Future Backlog

- Add Storybook or a small `/dev/ui` route only after the first wrapper set stabilizes.
- Add dark theme using daisyUI `prefersdark` only after the light `birdless` theme is stable.
- Add React Aria `Select`, `ComboBox`, `Tabs`, or `Table` wrappers when real app features need them.
- Consider React Aria `TagGroup` if tags become removable filters instead of simple links.
- Consider React Aria `Breadcrumbs` for chapter reader breadcrumbs if the breadcrumb pattern spreads beyond that page.
- Add visual regression screenshots with Playwright once the design-system migration starts changing high-traffic pages.
- Add lint rules or import restrictions to discourage direct `react-aria-components` imports outside `src/components/ui/aria`.

## 12. Test And Verification Plan

Automated checks:

- `pnpm lint`
- `pnpm test`
- `pnpm build`

Targeted test files to update or add:

- `tests/components/header.test.tsx`
- `tests/components/chapter-password-gate.test.tsx`
- `tests/components/chapter-toc-drawer.test.tsx`
- `tests/components/chapter-toc.test.tsx`
- `tests/components/chapter-list.test.tsx`
- `tests/components/comment-item.test.tsx`
- `tests/components/book-item.test.tsx`
- `tests/components/books-grid.test.tsx`
- `tests/components/banner.test.tsx`
- `tests/components/posts.test.tsx`
- `tests/components/categories.test.tsx`
- `tests/components/categories-rail.test.tsx`

Manual smoke routes:

- `/`
- `/posts/[slug]`
- `/books`
- `/books/[slug]`
- `/books/[slug]/chapters/[chapterSlug]`
- `/books/shelf`
- `/categories`
- `/about`
- `/auth/signup?returnTo=/&source=header`

Manual accessibility checks:

- Keyboard tab order through header and main interactive controls.
- Visible focus rings on buttons, links, comment actions, password controls, and TOC trigger.
- Escape key and focus restoration for the mobile TOC dialog.
- Screen-reader names for icon buttons such as show/hide password and close TOC.
- Error messages associated with password/comment fields.

Manual visual checks:

- Header stays `#416275`-driven and does not become a generic daisyUI theme.
- Cards, panels, comments, and forms use consistent radius, border, and base colors.
- Rich content in posts and chapters remains readable.
- Homepage/post heroes keep real media-first presentation.
- Mobile layouts do not introduce text overlap or cramped buttons.

## 13. Definition Of Done

The migration is done when:

- `react-aria-components` and daisyUI are installed and configured for Tailwind CSS 4.
- A `birdless` daisyUI theme maps the existing brand colors into semantic daisyUI tokens.
- Interactive primitives used by the app are local React Aria wrappers styled with daisyUI.
- Page-level components compose layout and feature components rather than repeated low-level HTML/Tailwind recipes.
- Header/navigation has been rethought around React Aria and daisyUI, with current auth behavior preserved.
- Forms, comments, reader drawer, buttons, links, loading/progress, badges, and panels use the new architecture where applicable.
- Compatibility exports from the old `src/components/shared/ui` layer are removed or intentionally documented.
- `pnpm lint`, `pnpm test`, and `pnpm build` pass.
- Manual smoke verifies the routes and accessibility checks listed in this document.

## 14. Final Model

The final UI architecture should look like this:

- React Aria Components provide interaction behavior through a small, project-owned wrapper layer.
- daisyUI provides semantic style classes and theme tokens, with the blog's existing blue identity mapped into the theme.
- Layout is a first-class layer with named page, feed, content, hero, and reader components.
- Domain shared components for books, posts, taxonomy, and comments compose those primitives instead of owning their own button/form/dialog systems.
- Route files remain thin and focused on server data, metadata, and page composition.

This gives the blog a sustainable path as the UI grows: new features pick from stable layout and aria/daisyUI primitives, while one-off Tailwind remains limited to local layout details that are genuinely unique.
