# UI Architecture

> Status: implemented baseline
>
> Date: 2026-05-15
>
> Scope: `src/components/ui/**`, `src/components/layout/**`, `src/components/core/**`, page and shared UI composition.

## Table Of Contents

- [Component Layers](#component-layers)
- [Theme](#theme)
- [Interactive Primitives](#interactive-primitives)
- [Layout Primitives](#layout-primitives)
- [Static Surfaces](#static-surfaces)
- [Import Rules](#import-rules)
- [Verification](#verification)

## Component Layers

The blog UI is split into these layers:

- `src/app/**`: route data loading, metadata, and route-level composition.
- `src/components/layout/**`: page shell, page sections, content columns, feed layout, reader layout, and media hero.
- `src/components/core/**`: global app chrome and app effects. `Header` and `Layout` are compatibility exports around the new `AppHeader` and `PageShell`.
- `src/components/ui/aria/**`: project-owned React Aria wrappers styled with daisyUI classes.
- `src/components/ui/surface/**`: static daisyUI-backed surfaces such as cards, badges, panels, alerts, and status text.
- `src/components/shared/**`: domain surfaces for books, posts, taxonomy, comments, rich content, and media.

## Theme

Tailwind CSS loads daisyUI from `src/styles/index.css` with the `birdless` theme.

The theme maps the existing brand colors into daisyUI tokens:

- `primary`: `#416275`
- `secondary`: `#3a5a6b`
- `base-100`: `#ffffff`
- `base-200`: `#fafafa`
- `base-300`: `#eaeaea`

Keep `blue` and `darkBlue` in `tailwind.config.js` as compatibility aliases during the transition, but new shared UI should prefer daisyUI semantic classes such as `btn-primary`, `text-primary`, `badge-primary`, and `progress-primary`.

## Interactive Primitives

Use `src/components/ui/aria/**` for app controls:

- `button.tsx`: `Button`, `ButtonLink`, `TextActionButton`, and `getButtonClassName`.
- `link.tsx`: `TextLink`, `BadgeLink`, and `getTextLinkClassName`.
- `text-field.tsx`: `TextField`, `TextAreaField`, `FieldError`, and `getInputClassName`.
- `modal.tsx`: `Modal` built on React Aria modal/dialog primitives.
- `progress.tsx`: `LoadingSpinner` and `ProgressBar`.

Do not import directly from `react-aria-components` in feature or page components. Add or extend a local wrapper first.

## Layout Primitives

Use `src/components/layout/**` for repeated page structure:

- `PageShell`: app main wrapper, fixed-header offset, and draft banner.
- `PageSection`: container plus common vertical spacing and width presets.
- `ContentColumn`: named content width variants.
- `FeedLayout`: homepage feed plus rail layout.
- `ReaderLayout`: chapter reader grid plus TOC slot.
- `MediaHero`: homepage and post image hero layout.

Page components should compose these primitives instead of repeating `Layout + Container + mx-auto` recipes.

## Static Surfaces

Use `src/components/ui/surface/**` when React Aria does not provide an interaction model:

- `Card`, `Panel`, and `CenteredPanel` use daisyUI `card` semantics.
- `Badge` uses daisyUI badge variants.
- `StatusText` and `Alert` provide consistent loading, empty, error, and warning states.

## Import Rules

The old `src/components/shared/ui/**` compatibility layer has been removed. Existing app code should import from:

- `@/components/ui/aria/*` for interactive controls.
- `@/components/ui/surface/*` for static surfaces.
- `@/components/layout/*` for page structure.

`src/components/core/layout.tsx` and `src/components/core/container.tsx` remain small compatibility exports for older code and tests, but new code should use `src/components/layout/**` directly.

## Verification

For changes that touch shared UI, layout, header, comments, reader surfaces, or Tailwind/daisyUI theme setup, run:

```bash
pnpm lint
pnpm test
pnpm build
```
