# Blog UI Shared Style Plan

## Scope

This plan covers the style mismatch on `pages/auth/signup.tsx` and the duplicated button, card, and form styling found in the books flow.

Primary files reviewed:

- `pages/auth/signup.tsx`
- `components/pages/books/chapter-password-gate.tsx`
- `pages/books/index.tsx`
- `pages/books/[slug].tsx`
- `pages/books/[slug]/chapters/[chapterSlug].tsx`
- `components/pages/books/chapter-list.tsx`
- `components/pages/books/chapter-toc.tsx`
- `components/pages/books/chapter-toc-drawer.tsx`
- `components/shared/bookmark-button.tsx`
- `components/shared/comments/CommentComposer.tsx`
- `tailwind.config.js`
- `styles/index.css`

## Current Findings

`pages/auth/signup.tsx` renders a fallback-only auth error page when signup intent creation fails. It uses `Header` directly, a full-screen `main`, and standalone button classes. This makes the page feel detached from the rest of the blog because the books and home flows normally use `Layout`, `Container`, `Text`, compact content widths, and the established blue/darkBlue action treatment.

The books area already has a recognizable style:

- Page shell: `Layout` with `Container`, usually `className="flex flex-col items-center"` and `Container className="my-4 w-full md:px-20"`.
- Section heading: `Text`, currently `font-bold text-blue leading-8`.
- Primary action: `bg-blue text-white hover:bg-darkBlue`, usually rounded with compact padding.
- Secondary action: border, gray/slate text, hover border/text darkening.
- Form focus: blue border/ring, gray/slate text, disabled opacity or disabled blue state.
- Cards and panels: white background, subtle gray/slate border, rounded corners.

The same concepts are implemented with different exact classes:

- Signup buttons use `rounded bg-blue px-4 py-2 font-semibold` and `rounded border border-slate-300`.
- Book detail "Continue reading" uses `inline-flex items-center gap-2 rounded bg-blue px-4 py-2 text-sm font-medium`.
- Password gate submit uses `inline-flex h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-semibold`.
- Comments submit uses `rounded bg-blue px-4 py-1.5 text-sm font-medium`.
- Retry buttons use `rounded-md border border-gray-300 px-4 py-2 text-sm`.
- Bookmark buttons use a stateful filled/outlined pair.
- Inputs and textareas repeat focus and border rules with small variations.

## Recommendation

Create shared React UI primitives for repeated compound styles, then use Tailwind config only for design tokens. Do not solve this with Tailwind config alone.

Reasoning:

- Tailwind config is good for tokens such as `blue`, `darkBlue`, radii, shadows, spacing, and font sizes.
- Tailwind config is not good for component variants such as primary/secondary/ghost/destructive buttons, disabled state, icon spacing, full-width form actions, error inputs, or link-vs-button semantics.
- A small shared component layer lets pages keep semantic elements correct while eliminating copied class strings.

## Target Design Rules

Use these rules as the canonical blog UI style for this pass:

- Primary actions: `inline-flex items-center justify-center rounded bg-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-darkBlue disabled:cursor-not-allowed disabled:opacity-60`.
- Primary large form actions: same visual identity, but `h-11 rounded-xl font-semibold`.
- Secondary actions: `inline-flex items-center justify-center rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60`.
- Ghost actions: `inline-flex items-center justify-center rounded px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60`.
- Text links: `font-medium text-blue hover:underline`.
- Form controls: `w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-blue focus:ring-1 focus:ring-blue disabled:opacity-50`.
- Error form controls: same base, with `border-red-300 focus:border-red-500 focus:ring-red-500`.
- Cards/panels: `rounded-2xl border border-slate-200 bg-white`.
- Page fallback cards: centered max width, `max-w-xl`, `px-4 py-5 sm:px-6 sm:py-6`.

Keep `blue` and `darkBlue` as the blog brand action colors. Do not introduce a new color palette during this cleanup.

## Proposed Shared Files

### `components/shared/ui/button.tsx`

Create a small button/link primitive with reusable class generation.

Exports:

```tsx
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export function getButtonClassName(options?: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}): string;

export function Button(props: ButtonProps): JSX.Element;
export function ButtonLink(props: ButtonLinkProps): JSX.Element;
```

Implementation notes:

- Use existing `classnames` dependency.
- `Button` renders native `button`.
- `ButtonLink` renders Next `Link`.
- Add an optional `hardNavigate?: boolean` to `ButtonLink` only if auth logout/signup/login needs plain `<a>` behavior later. For this signup fallback, normal `Link` is enough because the fallback links point to local routes.
- Keep the API intentionally small. Do not add `asChild` or a new dependency.

Recommended class mapping:

```ts
const base =
  'inline-flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

const variants = {
  primary: 'bg-blue text-white hover:bg-darkBlue',
  secondary: 'border border-gray-300 text-gray-700 hover:border-gray-400 hover:text-gray-900',
  ghost: 'text-gray-600 hover:text-gray-900',
  danger: 'bg-red-600 text-white hover:bg-red-700',
};

const sizes = {
  sm: 'rounded px-3 py-1.5 text-sm font-medium',
  md: 'rounded px-4 py-2 text-sm font-medium',
  lg: 'h-11 rounded-xl px-4 text-sm font-semibold',
};
```

### `components/shared/ui/form-control.tsx`

Create reusable form control class helpers first. Full components can come later if needed.

Exports:

```tsx
export function getInputClassName(options?: {
  hasError?: boolean;
  className?: string;
}): string;

export function FieldError({ children }: { children?: React.ReactNode }): JSX.Element | null;
```

Implementation notes:

- Use the helper in `chapter-password-gate.tsx` and `CommentComposer.tsx`.
- Keep `textarea` support by using the class helper rather than only an `Input` component.
- Preserve specialized padding such as password input `pl-9 pr-10` through `className`.

### `components/shared/ui/panel.tsx`

Create a reusable surface for centered status/form panels.

Exports:

```tsx
export function Panel(props: {
  children: React.ReactNode;
  className?: string;
}): JSX.Element;

export function CenteredPanel(props: {
  children: React.ReactNode;
  className?: string;
}): JSX.Element;
```

Recommended classes:

```ts
const panelBase = 'rounded-2xl border border-slate-200 bg-white';
const centeredPanelBase = 'mx-auto w-full max-w-xl px-4 py-5 sm:px-6 sm:py-6';
```

Use this for `ChapterPasswordGate` and the signup unavailable fallback.

### Optional Later: `components/shared/ui/status-card.tsx`

Only create this if another fallback/status page is added. For this pass, `Panel`, `Button`, and form helpers are enough. A status-card abstraction would be premature if it only wraps one signup page.

## Tailwind Config Proposal

Keep `tailwind.config.js` focused on tokens.

No required Tailwind config changes are needed for the first implementation. Existing tokens already cover:

- `blue`
- `darkBlue`
- `shadow-small`
- `shadow-dark`
- custom spacing and typography

Optional token additions, only if repeated during implementation:

```js
borderRadius: {
  panel: '1rem',
  control: '0.75rem',
},
boxShadow: {
  panel: '0 12px 30px rgba(15, 23, 42, 0.08)',
},
```

Do not add Tailwind plugin component classes such as `.btn-primary` in `styles/index.css` for this codebase. Most components already use className composition in TSX, and a TS helper keeps variants type-safe and discoverable.

## Signup Page Target

Change `pages/auth/signup.tsx` fallback rendering from standalone page styling to the blog shell:

- Replace direct `Header` usage with `Layout`.
- Use `Container`.
- Use a centered `Panel`.
- Use shared `ButtonLink` for "Sign in" and "Back to blog".
- Keep the server-side behavior unchanged.
- Keep returning `null` when signup intent succeeds and the page redirects.

Target shape:

```tsx
return (
  <Layout header="Blog" className="flex flex-col items-center">
    <Container className="my-4 w-full md:px-20">
      <Panel className="mx-auto w-full max-w-xl px-4 py-5 sm:px-6 sm:py-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue">
          Account access
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Sign up is not available
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
          ...
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <ButtonLink href={`/auth/login?returnTo=${encodeURIComponent(returnTo)}`}>
            Sign in
          </ButtonLink>
          <ButtonLink variant="secondary" href={returnTo}>
            Back to blog
          </ButtonLink>
        </div>
      </Panel>
    </Container>
  </Layout>
);
```

Important behavior note:

- `returnTo` is already normalized by `normalizeReturnTo`, so `href={returnTo}` remains acceptable.
- The login link must continue to encode `returnTo`.
- Do not fetch homepage data for this fallback unless the product requirement is that the auth page title must be CMS-driven. `header="Blog"` matches the current page behavior and avoids adding SSR dependency to an error path.

## Books Flow Migration

### `components/pages/books/chapter-password-gate.tsx`

Replace duplicated card, input, error, and submit classes:

- Use `Panel` for the outer section.
- Use `getInputClassName({ hasError: Boolean(error), className: 'h-11 rounded-xl pl-9 pr-10 focus:ring-0' })` or decide that password gate should adopt the shared `focus:ring-1`.
- Use `Button` with `size="lg"` and `fullWidth`.
- Keep `classnames` only if still needed for non-shared conditional classes. Otherwise remove it from the file.

Expected visual result:

- Same centered locked-chapter card.
- Same blue primary submit behavior.
- More consistent disabled state.
- Same password visibility toggle.

### `pages/books/[slug].tsx`

Replace "Continue reading" with `ButtonLink`.

Current:

```tsx
className="inline-flex items-center gap-2 rounded bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-darkBlue"
```

Target:

```tsx
<ButtonLink href={...}>Continue reading</ButtonLink>
```

Keep the progress pill unchanged for now. It is not a button and does not need abstraction.

### `pages/books/index.tsx` and `pages/index.tsx`

Replace retry buttons with `Button` variant `secondary`.

Current retry buttons use similar but not identical border styling. The shared secondary variant should become the canonical retry style.

### `pages/books/[slug]/chapters/[chapterSlug].tsx`

Replace the mobile "Table of contents" button with `Button` variant `secondary` and keep its icon.

Do not change breadcrumb links or previous/next chapter links in this pass. Those are text links and can remain `text-blue hover:underline` until a later `TextLink` helper is worth it.

### `components/pages/books/chapter-toc-drawer.tsx`

Replace the "Close" button with `Button` variant `secondary` size `sm`.

### `components/shared/bookmark-button.tsx`

This is stateful and slightly specialized. Two acceptable implementation options:

Option A, recommended for first pass:

- Keep `BookmarkButton` local classes for now.
- Align radius/font/disabled with shared button conventions manually.
- Reason: the active/inactive bookmark state includes icon and pressed semantics and may need a `pressed` variant later.

Option B, if touching it during implementation:

- Use `getButtonClassName` for inactive state with `variant="secondary"` and active state with `variant="primary"`.
- Add `className="gap-1.5 px-3 py-1.5"` override if the default `md` size is too large.

### `components/shared/comments/CommentComposer.tsx`

Replace submit and cancel buttons:

- Submit: `Button size="sm"` or `Button className="px-4 py-1.5"`.
- Cancel: `Button variant="ghost" size="sm"`.
- Textarea: use `getInputClassName()`.

Keep the character counter and layout unchanged.

## Implementation Order

1. Add `components/shared/ui/button.tsx`.
2. Add `components/shared/ui/form-control.tsx`.
3. Add `components/shared/ui/panel.tsx`.
4. Update `pages/auth/signup.tsx` to use `Layout`, `Container`, `Panel`, and `ButtonLink`.
5. Update `components/pages/books/chapter-password-gate.tsx` to use `Panel`, `Button`, and form helpers.
6. Update low-risk button duplicates in `pages/books/[slug].tsx`, `pages/books/index.tsx`, `pages/index.tsx`, and `components/pages/books/chapter-toc-drawer.tsx`.
7. Update `CommentComposer` if the shared `Button` and form helper API feels stable.
8. Consider `BookmarkButton` only after the core style migration is done.

## Testing Plan

Run:

```bash
pnpm lint
pnpm test
```

Manual checks:

- Visit `/auth/signup?returnTo=/books` with signup intent failure forced or mocked. Verify the fallback page uses the blog header, content width, card surface, and shared button styling.
- Visit `/books`. Verify book grid layout and retry state still render.
- Visit a book detail page. Verify "Continue reading" and bookmark actions still work.
- Visit a chapter page on mobile width. Verify the TOC button opens the drawer and the drawer close button works.
- Visit a locked chapter. Verify password input, show/hide button, error state, disabled submit, successful unlock, and page refresh still work.
- Visit comments. Verify textarea focus, submit disabled state, submit loading label, and cancel action.

## Acceptance Criteria

- Signup fallback no longer uses its own full-screen white layout.
- Primary and secondary buttons across signup, books, password gate, retry states, and comments use the same shared source of truth.
- Password gate keeps its current behavior and becomes the reference style for form-card flows.
- Tailwind config remains token-focused and does not become a dumping ground for component classes.
- No auth redirect, return URL, chapter unlock, bookmark, infinite scroll, or comment behavior changes.
- `pnpm lint` and `pnpm test` pass.

## Non-Goals

- Do not redesign the whole blog.
- Do not migrate every link to a new text-link component.
- Do not change CMS data fetching.
- Do not introduce a UI library dependency.
- Do not replace `classnames`.
- Do not change auth signup/login backend behavior.

## Risks

- `ButtonLink` typing can become over-complicated if it tries to support every Next `Link` and native anchor case. Keep it narrow at first.
- Changing focus rings may create visual differences in forms. Prefer consistent accessibility over exact pixel preservation.
- `Layout` probes `/api/auth/session`; using it on the signup fallback is consistent with the blog shell but adds client-side auth-state probing to the fallback page.
- `BookmarkButton` has pressed state and loading state; migrating it too early may blur the API of the generic button component.

## Suggested First PR Scope

Keep the first implementation PR small:

- Add `Button`, `ButtonLink`, `Panel`, and form-control helpers.
- Migrate `pages/auth/signup.tsx`.
- Migrate `components/pages/books/chapter-password-gate.tsx`.
- Migrate "Continue reading" and retry buttons.
- Leave `BookmarkButton` for a follow-up unless the resulting visual mismatch is still obvious.

This gives the signup page the blog style immediately while establishing reusable patterns for the rest of the book UI.
