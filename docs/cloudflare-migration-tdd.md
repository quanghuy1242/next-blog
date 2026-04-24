# TDD Blueprint for Migrating This Blog to OpenNext on Cloudflare Workers

> This document defines a test-driven migration strategy for deploying the current pages-router Next.js blog to Cloudflare Workers through [OpenNext Cloudflare](https://opennext.js.org/cloudflare).
> It is intentionally written as an architecture and verification document, not as an implementation checklist.

## Executive Summary

The critical architectural fact is that this repository is still a Pages Router application. OpenNext Cloudflare explicitly supports the Pages Router, so a Cloudflare deployment does not require an App Router rewrite. That means the safest migration path is to treat Cloudflare as a platform change first, then revisit the router shape later if and when the product direction calls for it.

TDD is the right lens for that migration because the riskiest part is not the code that already exists. The risk is the interaction between build output, worker runtime, bindings, cache semantics, and deploy tooling. A good migration plan should therefore start by freezing current behavior with tests, then introduce Cloudflare infrastructure in small increments, and finally verify the deployed worker with smoke tests that run against the same runtime the site will use in production.

The goal of this document is to define what must not change, what can change, which tests prove the difference, and what signals should block a release.

## 1. Current Architectural Baseline

### 1.1 What Exists Today

This codebase is a classic Next.js blog with a Pages Router layout. The route surface lives under `pages/`, API routes live under `pages/api/`, and the app uses ISR on several pages through `getStaticProps` revalidation. The repository does not contain an `app/` directory, so there is no App Router implementation to preserve or replatform.

The content model is intentionally simple. Posts, categories, books, and chapters are all fetched through thin API wrappers. Rich text is rendered through a custom Lexical renderer, and media is already handled through Cloudflare R2 style URL transformations rather than relying on Next.js image optimization middleware. That means the current app already contains a few choices that are friendly to a Cloudflare deployment.

The project also already has a modern toolchain foundation. It is on Next 16, React 19, Tailwind CSS v4, pnpm, and TypeScript 6. The build already passes in the current state of the repo, which is a useful baseline because the migration should build on top of a known-good system rather than try to solve unrelated technical debt at the same time.

### 1.2 What OpenNext Cloudflare Changes

OpenNext Cloudflare is not a host-specific wrapper around a finished worker artifact. It takes the Next build output, transforms it, and packages that output so it can run on Cloudflare Workers. In practical terms, the contract is not just "does the app compile." The contract is "does the Next build output become a valid Worker deployment that still behaves like the original app."

That distinction is why TDD matters. A code change that looks harmless in `next build` can still break worker deployment if it depends on the wrong runtime, the wrong cache backend, missing bindings, or a feature that is unsupported in the Cloudflare runtime. The tests need to catch those problems before the deployment step does.

### 1.3 Why the Current Shape Is Favorable

This repo is already on the route model that OpenNext Cloudflare supports. The blog is content-heavy, mostly static with ISR, and does not appear to rely on advanced middleware patterns. That makes it a good candidate for a staged migration.

The current build output is also not obviously in danger of the 3 MiB gzip worker limit on the free Cloudflare plan based on the rough server-side bundle estimate we inspected earlier, but that estimate is only a proxy. The first OpenNext Cloudflare build still needs to measure the real compressed worker artifact and compare it against a plan-specific budget before anyone treats the migration as release-ready.

## 2. What TDD Means Here

### 2.1 TDD Is Behavior First, Not Implementation First

In a migration, TDD is not about writing unit tests for every internal helper before touching infrastructure. It is about making the intended behavior explicit enough that the migration can be done in narrow, reversible increments.

For this blog, behavior means route output, page metadata, API response shape, revalidation semantics, image URLs, and deploy-time invariants such as worker size and bindings. Those are the things a user or an operator would actually notice if the migration went wrong.

A migration that is only validated by a successful local build is too weak. A migration that is only validated by a deployed worker is too expensive to debug. TDD gives you a middle ground: enough test coverage to express the contract, but not so much that the migration becomes an infrastructure rewrite inside the test suite.

### 2.2 Three Nested Loops

A Cloudflare migration benefits from three overlapping TDD loops.

The first loop is the code-level red-green-refactor cycle. This is where you write or tighten unit and integration tests around the existing Next app so behavior is pinned down before any Cloudflare-specific changes happen.

The second loop is the platform-level contract cycle. Here the tests verify the shape of the deployment artifact, the runtime mode, the bindings, and the caching model. These tests answer questions such as whether the app can be built into a worker, whether the worker gets the right environment, and whether the cache layer is configured correctly for the site's ISR profile.

The third loop is the release-level smoke cycle. These tests run against a preview or deployed worker and confirm that the app responds correctly in the actual Cloudflare runtime. If the first two loops are strong, the release loop becomes a confidence check instead of a forensic exercise.

### 2.3 What Not to Turn Into TDD Noise

Not everything should be tested at the same level of detail. If a utility is pure and stable, a unit test is enough. If a page renders a lot of existing data, a focused integration test is enough. If a deployment artifact is produced by OpenNext, a smoke test and a size gate are usually enough.

What should not happen is a speculative test explosion around implementation details that are likely to change during the migration. For example, the document should not encourage testing generated worker file names, internal adapter paths, or Next build internals unless those details are truly part of the contract you want to protect. For the deployment artifact itself, a preview smoke test plus a size gate are the minimum floor, but they are not sufficient on their own for ISR, bindings, or cache-sensitive routes.

## 3. Cloudflare Constraints That Matter

### 3.1 Node.js Runtime, Not Edge

OpenNext Cloudflare expects the Next app to run in the Node.js runtime, which is more fully featured than the Edge runtime. That matters because the Edge runtime intentionally constrains Node APIs, and OpenNext does not yet support every feature that would be available there.

For this migration, that means the test plan should treat Edge runtime usage as a regression. If any route or shared code starts depending on Edge-only behavior, that should be a failure for the migration track. The worker path should stay aligned with Node-compatible behavior, because that is the supported route for OpenNext Cloudflare. In this repository snapshot there is no middleware entrypoint, so there is no separate edge-specific path to preserve.

This is one of the reasons I would not try to mix an App Router migration into the Cloudflare migration unless there is a strong business reason to do both at once. App Router work often tempts teams into Edge-minded patterns, and that is a separate architectural decision from moving the deployment target to Workers.

### 3.2 Pages Router Support Is a Real Advantage

The OpenNext Cloudflare docs explicitly list Pages Router support. For this repository, that means the current route model is already compatible with the target platform. You do not need to reinterpret the whole site around server components just to deploy to Cloudflare Workers.

That is the practical reason to do Cloudflare first. It lets you validate the deployment and runtime story while leaving route semantics mostly intact. You can then evaluate App Router later as a deliberate product architecture choice instead of as a migration side effect.

### 3.3 Caching Model

The site uses ISR, which means the Cloudflare cache strategy matters. OpenNext Cloudflare supports several cache components, but not all of them are appropriate for this app as it exists today.

For a Pages Router app using time-based revalidation, the relevant pieces are the incremental cache and the queue that coordinates revalidation. OpenNext recommends R2 for the incremental cache. That fits this blog because it already relies on content fetching and static regeneration rather than heavy on-demand tag invalidation. R2 is not free, though: it introduces storage and operation costs, so the migration should justify it on correctness and operational fit rather than on a claim that it is costless. For a blog of this size the cost is usually acceptable, but it should still be monitored after launch.

The docs also make an important distinction: Workers KV is not recommended for this role because it is eventually consistent. That is a strategic detail, not a tuning tip. If your cache layer is allowed to be eventually consistent, you are inviting stale content risk into a blog that should otherwise be deterministic.

For this app, the test plan should care about three things:

- static routes remain cacheable and load quickly
- ISR revalidation still refreshes content when the expiration window passes
- cached content is not unexpectedly stale because the wrong backing store was chosen

If a later App Router migration introduces `revalidateTag` or `revalidatePath`, then tag cache and cache purge become relevant. Today, that is future scope, not current scope.

### 3.4 Bindings and Environment Variables

Cloudflare deployment is not just a build pipeline. It is a worker with bindings, secrets, and sometimes typed environment access. OpenNext Cloudflare uses a Wrangler configuration file for that wiring, and the docs show that bindings can be accessed through `getCloudflareContext`. In Pages Router API routes and other runtime server code, that is the access path. When SSG code needs bindings during generation, the async form `getCloudflareContext({ async: true })` is the supported shape. Remote bindings are available, but they should stay opt-in because they can pull production-adjacent data into local builds and preview runs. If the team needs remote bindings with an older Wrangler toolchain, the OpenNext docs call for the `experimental.remoteBindings` dev flag, which should remain a migration exception rather than the default.

For this repository, the testing implication is that any Cloudflare-specific dependency should be explicit and should fail early if the binding is missing. That includes R2 for incremental cache, any self-reference service binding for revalidation workflows, and any future image or database bindings if they are added.

Remote bindings can be useful during development, but they should be treated carefully because they can pull production-adjacent data into local builds and static generation. A TDD plan should not make remote bindings the default until the team has a concrete reason to use them. For this repo, the safer baseline is local emulation through `.dev.vars`, then an explicit staging-worker test when a binding cannot be faithfully emulated.

### 3.5 Images and Static Assets

OpenNext Cloudflare supports image optimization, but it can be enabled either through a Cloudflare Images binding or a custom loader. That matters because this repo is not currently relying on Next's default image optimizer. The app already uses unoptimized image behavior with custom URL transformations, which is much simpler to reason about during a migration and is easier to keep stable while the worker packaging changes.

Static assets are another subtle area. The worker does not sit in front of immutable build assets the same way a normal Node server does, and Next's `headers()` config does not control `public` or `_next/static` under this adapter. For that reason, the long-lived immutable rule belongs in `public/_headers`, and the preview workflow should verify the response headers on `/_next/static/*` rather than assuming the rule is applied.

The test plan should therefore validate both static asset headers and representative image URL generation separately from page rendering. A deployment can be technically valid and still be operationally slower if the cache headers or transform output are wrong. That kind of defect will not show up in a unit test, but it will show up in production traffic.

### 3.6 Worker Size Limits

Cloudflare Workers have a gzip-compressed upload limit. The free plan is small enough that worker size should be treated as an operational constraint, not just a packaging detail. The docs emphasize that the compressed size is what matters.

For this repo, the rough server-side proxy estimate looked comfortably below the free-plan limit, but the OpenNext-produced worker should still be measured after the actual adapter build. That means the release plan should include a size gate, and the TDD plan should treat size regressions as release-blocking if they cross the agreed budget.

### 3.7 CPU Budget and Blocking Generation

Cloudflare Workers also impose CPU accounting on request execution, so first render work is part of the migration risk surface. In this blog, that matters most for Pages Router routes that use `fallback: 'blocking'` for a cold slug, and for any SSR or API route that depends on PayloadCMS while the page is being generated.

The test plan should explicitly exercise a cold post slug, a slow backend simulation, and at least one worker preview request that is expected to generate on the fly. The point is to see whether the worker still finishes within the platform budget and whether the route fails in a controlled way when PayloadCMS is slow or unavailable. That is a real timeout risk, not a theoretical one, because the first uncached request still has to do the generation work inside the worker.

## 4. Test Strategy by Layer

| Layer | Purpose | What it proves | What it does not prove |
| --- | --- | --- | --- |
| Unit | Protect pure logic | Utilities still transform data correctly | The worker deploys correctly |
| Integration | Protect page and API behavior | Routes render the expected content and status codes | Cloudflare bindings are wired |
| Build | Protect compilation | Next can still build the app | The output runs in Workers |
| Worker preview | Protect runtime integration | OpenNext output runs in the Cloudflare runtime | Production traffic, scale, or cache warmup |
| Smoke | Protect release behavior | Real deployed routes respond correctly | Long-term cache correctness |
| Size gate | Protect deployability | Worker stays inside the upload budget | Runtime behavior on its own |

### 4.1 Unit Tests

The unit test layer should remain focused on the code that is easiest to reason about. In this repo, that includes tag normalization, date formatting, meta tag generation, image URL helpers, query builders, and any pure support logic that is not directly tied to the Cloudflare runtime.

These tests are valuable in the migration because they let you prove that the data-shaping layer did not change while the deployment target did. If a Cloudflare preview test fails, unit tests help you separate "the worker broke" from "the data processing changed." That is a real time saver once the migration has multiple moving parts.

### 4.2 Integration Tests

Integration tests should cover the actual output of representative pages and API routes. For example, the post page should continue to render Lexical content and metadata correctly, the about page should still render the author bio, the categories page should still resolve its data, and the API routes should still return the same JSON shapes and failure codes.

The practical rule is this: if a user can observe the behavior, an integration test should probably exist for it. That does not mean every branch must be mocked. It means the test should prove the page or endpoint still behaves as expected when the platform underneath it changes.

### 4.3 Build Tests

The build gate is where migration work usually starts to get real. `pnpm build` has already proven that the current codebase compiles. The Cloudflare migration should preserve that property and add one more: the build output should be something that OpenNext Cloudflare can transform into a valid worker.

At this layer, the test target is not source code correctness alone. It is source code plus production packaging. Build tests should catch unsupported runtime declarations, missing bindings assumptions, and accidental dependency growth before the worker preview ever happens.

### 4.4 Worker Preview Tests

Worker preview is the first time the migration is really tested in the target runtime. This is where OpenNext Cloudflare's own build-transform-preview loop becomes useful, because it is the closest thing to production without actually deploying.

A good preview test should confirm that the key routes respond in the worker runtime, that static assets are served with the expected caching behavior, that bindings resolve, and that any ISR or cache-driven page still behaves as expected after the Cloudflare transform.

### 4.5 Production Smoke Tests

Smoke tests should be narrow and high-value. They are not a substitute for the rest of the suite. Their job is to answer a single question: did the deployment preserve the public contract?

For this blog, that means checking the homepage, a representative post, the about page, the categories page, one or two book-related routes, a representative API route, and a 404 path. If those pass in production, the migration is probably healthy enough to let normal traffic exercise the rest.

## 5. Characterization Tests First

### 5.1 Why Characterization Matters

The most dangerous part of a platform migration is false confidence. Teams often think they know how an app behaves, then discover that there were hidden assumptions in metadata, fallback content, image URLs, or response codes.

Characterization tests avoid that trap. They do not try to improve the architecture first. They simply record what the app does now. That is exactly what you want before changing the deployment target. Once those tests exist, you can migrate infrastructure without guessing whether a behavioral difference was intentional.

### 5.2 Good Characterization Targets in This Repo

The first tests should focus on user-visible behavior and core data flow:

- homepage content and metadata
- post page rendering, including Lexical content, tags, and representative image URLs
- about page rendering for author bio and avatar image URLs
- category filtering and list rendering
- book and chapter routes
- API route payload shape and error behavior
- helper functions for dates, tags, queries, and image URLs

These are the boundaries most likely to be affected by a Cloudflare deployment because they combine server logic, caching, and page rendering. Lexical rendering itself is not Cloudflare-specific, but its output is part of the route contract that must not change when the worker starts serving the page.

### 5.3 What Those Tests Should Assert

A good characterization test does not just assert that a component renders. It asserts the conditions that make the page meaningful.

For example, a post page test should prove that the page still renders a title, metadata, content body, and expected fallback behavior when content is missing. A category page test should prove that the route shape and filters are preserved. An API test should prove that errors remain errors and successful responses keep the same schema.

The purpose is not to overfit the tests to the current implementation. The purpose is to define the contract of the site well enough that any Cloudflare-specific regression becomes visible.

## 6. Cloudflare-Specific Contract Tests

### 6.1 Build Artifact Expectations

A Cloudflare migration should add tests for the deployment artifact itself. These are not deep internals tests. They are contract tests that answer whether the output is deployable.

Examples of useful checks include whether the build still succeeds, whether OpenNext Cloudflare can transform the build output, whether the worker entrypoint exists, whether the static asset bundle is present, and whether the deployment configuration includes the correct compatibility date and Node.js compatibility flags.

These tests matter because OpenNext Cloudflare is not just serving the Next build directly. It is wrapping that build into a Worker artifact, and that transformation is where a lot of subtle breakage can happen.

### 6.2 Runtime Expectations

The worker runtime should be treated as a distinct execution environment. TDD should therefore include at least one preview pass that validates request handling, header behavior, and the ability to execute the page routes under the Worker runtime rather than the local Next dev server. For bindings, the access path should match the route type: runtime route handlers and API routes read bindings through `getCloudflareContext`, while SSG code that needs bindings should use the async form during generation. A missing binding should fail fast in preview, not be discovered after deploy.

For this blog, runtime expectations are especially important for pages that depend on server-generated data. A page may render correctly in the local Next runtime and still break if the worker runtime is missing a binding, misconfigured cache store, or a compatibility flag.

### 6.3 Configuration Expectations

The Cloudflare deployment will eventually need a Wrangler config, possibly an OpenNext config file, and a `.dev.vars` file if local binding emulation is used. A TDD plan should encode those as expected deployment inputs rather than ad hoc manual steps.

That does not mean the repository should rush to add every possible Cloudflare-specific file now. It means the tests should make it clear when one is required. Configuration is part of the contract, not a footnote, so CI should be able to validate the config parses, the bindings are declared, and the preview command starts from the checked-in worker definition.

## 7. Cache Strategy for This Blog

### 7.1 What the Site Needs Today

This site uses ISR, so the cache system needs to preserve time-based revalidation. OpenNext Cloudflare's docs recommend R2 for the incremental cache when revalidation is used. That matches the shape of this application, which is mostly read-optimized content with periodic refresh.

The queue layer also matters because time-based revalidation should be coordinated, not allowed to stampede. For a small blog, a Durable Object based queue is the normal recommendation. The docs also describe more advanced options, such as regional cache and long-lived modes, but the base requirement is simply to keep revalidation reliable.

R2 is not free, though: it introduces storage and operation costs, so the migration should justify it on correctness and operational fit rather than on a claim that it is costless. For a blog of this size the cost is usually acceptable, but it should still be monitored after launch.

### 7.2 What the Site Does Not Need Yet

Because this repository is Pages Router based and does not currently use on-demand revalidation via `revalidateTag` or `revalidatePath`, a tag cache is not required right now. That is important because a lot of Cloudflare guidance is written for App Router sites, and those notes can distract from what the current repo actually needs. The distinction here is about caching behavior, not router identity by itself. Pages Router `res.revalidate` is a separate mechanism and would use the self-reference service binding if the app ever chooses to add that behavior.

The docs also warn against using KV for incremental cache because of eventual consistency. That is a decisive architectural note. A TDD plan should not make it easy to accidentally choose the wrong storage backend just because it is available.

### 7.3 How to Test the Cache

Cache tests should focus on freshness, not just cache presence. A route that returns content quickly is not enough if the content is stale past the revalidation window. The tests should verify that cached routes remain readable, that revalidation does not break the route, and that stale content is eventually replaced by fresh content when the page is eligible for regeneration.

If the team later adds on-demand revalidation, then the test suite should expand to include self-reference bindings, purge behavior, and whatever tag cache implementation is chosen. That future work is separate from the current migration path.

## 8. Image Strategy

### 8.1 Preserve the Current Behavior First

The current app already uses `images.unoptimized = true` in `next.config.mjs`, which means the site is not depending on Next's built-in image optimizer. That is actually a good thing for the migration because it keeps image handling outside the most fragile part of the Cloudflare integration.

The safe TDD move is to preserve that behavior while the platform changes. The tests should assert that image URLs continue to render correctly, that the custom R2 URL transform still produces a resolvable URL in the worker preview, and that the page output does not unexpectedly switch to a different optimization model. The representative image checks should cover both post cover images and author avatar images because those are the visible paths this blog already uses.

### 8.2 When Cloudflare Image Optimization Becomes Relevant

OpenNext Cloudflare supports image optimization either through a Cloudflare Images binding or through a custom loader. That is useful if the product later decides it wants `next/image` optimization on Workers, but it is not a prerequisite for the first Cloudflare deployment.

If the team does decide to enable it later, the tests should focus on URL generation, source restrictions, and fallback behavior. The runtime contract would then include the Cloudflare image binding and any related dashboard configuration.

## 9. Worker Size and Packaging Discipline

### 9.1 Size Is an Operational Contract

The worker size limit is not a nice-to-have detail. It is part of whether the deployment exists at all. The free Cloudflare plan has a 3 MiB gzip limit, and the paid plan is 10 MiB. OpenNext Cloudflare surfaces the compressed size because that is the number that matters.

This means the migration should include a size gate. The gate does not need to be overly strict on day one, but it should exist. Otherwise it becomes too easy for unrelated dependency growth to quietly push the worker toward the limit.

### 9.2 What to Measure

Do not rely on a rough local folder size alone. The correct measurement is the OpenNext-produced worker upload size after the Cloudflare build process has run. The local `.next` directory is only a proxy. The first Cloudflare pipeline run should record the compressed OpenNext artifact as the baseline, then compare later runs against that baseline and the worker plan limit. That turns size into a release gate instead of a guess.

That said, the proxy is still useful as a trend signal. If the server-side chunk footprint grows quickly during the migration, that is a sign to inspect dependency changes before the worker bundle gets too heavy.

## 10. Migration Sequence

### 10.1 Cloudflare First, App Router Later

For this repository, the recommended sequence is to move to Cloudflare first and leave App Router for a later phase. The reason is simple: OpenNext Cloudflare already supports the Pages Router, so the deployment migration can be validated without rewriting the route model at the same time.

That separation keeps the test story cleaner. The first migration can focus on runtime, cache, bindings, and worker packaging. The second migration, if it ever happens, can focus on routing semantics, server component behavior, and any App Router-specific data flow changes.

### 10.2 What the First Migration Should Prove

The first Cloudflare migration should prove that the current site can be built, transformed, previewed, and deployed without changing user-facing behavior. In other words, the job is not to redesign the app. The job is to preserve the app under a new runtime contract.

If that succeeds, the team has a much better starting point for a later App Router migration. If it fails, the failure surface is narrower and easier to debug because only one axis of change was introduced.

## 11. Release Gates and Acceptance Criteria

The gates should be grouped by failure mode so the team can see what failed without guessing. A deployment can pass the build but fail runtime, or pass runtime but fail cache freshness, so the checks should not be merged into one undifferentiated list.

### 11.1 Deployment Gates

- OpenNext Cloudflare can transform the build output into a worker artifact.
- The measured gzip upload size stays under the chosen Cloudflare plan limit with a deliberate headroom margin.
- Wrangler config parses and includes `nodejs_compat`, a valid compatibility date, and the required bindings.
- Any generated types or config files that support deployment are present and in sync.

### 11.2 Runtime Gates

- Key routes render in preview under the Worker runtime.
- API routes keep their response shape and status codes.
- No edge-only assumptions or unsupported runtime patterns are introduced.
- Bindings resolve in the preview environment.

### 11.3 Cache and Asset Gates

- ISR pages refresh after their revalidation window.
- A cold `fallback: 'blocking'` post generation succeeds within the worker CPU budget.
- `/_next/static/*` returns immutable headers from `public/_headers`.
- Representative image URLs still resolve and load correctly.

### 11.4 Observability Gates

- Preview and deploy logs expose cache hits, regeneration, and failures.
- Timeout or revalidation failures can be tied back to the route and binding that caused them.
- The team can distinguish app errors from cache, binding, or worker packaging problems.

### 11.5 What a Passing Release Looks Like

A passing release is not just a green build. It is a deployment where the worker renders the same pages, reads the same content, honors the same cache rules, and remains comfortably within the upload budget. The release should be considered successful only if the worker preview and deployed smoke tests both pass.

Because preview cannot perfectly reproduce production CPU accounting, cache warmup, and traffic shape, the first production rollout should be treated as a canary with a narrow blast radius and explicit rollback criteria.

## 12. CI and Operational Model

### 12.1 Preferred Verification Sequence

A stable release sequence should look like this:

- `pnpm lint`
- `pnpm test:ci`
- `pnpm build`
- capture the OpenNext gzip size baseline
- `npx @opennextjs/cloudflare preview`
- production deploy after preview smoke tests pass

This is not just a build recipe. It is a control system. Each step filters a different class of failure. Lint and unit tests protect code quality, build protects compilation, preview protects runtime compatibility, and the deploy gate protects real-world behavior.

### 12.2 Why Preview Matters More Than a Local Next Server

OpenNext Cloudflare documents the preview command as the way to run the app locally in the Worker runtime. That matters because `next dev` and the Worker runtime are not the same environment. If the team only tests with `next dev`, it is easy to miss configuration or compatibility problems until deployment. Preview should start with local bindings when possible. If a binding cannot be faithfully emulated, use a staging worker or an explicit remote binding test instead of assuming preview proves production parity.

The TDD plan should therefore consider preview to be the first real Cloudflare runtime test, not an optional nicety.

### 12.3 Observability and Debugging

The docs also describe `NEXT_PRIVATE_DEBUG_CACHE=1` as a way to see cache behavior. That is useful because cache bugs are usually invisible until they show up as stale or inconsistent content. A migration strategy should preserve a clear debugging path for cache issues, especially around ISR. In production, the team should expect at minimum cache hit ratio, revalidation success and failure counts, request duration, timeout visibility, and worker 5xx visibility.

If the team later needs deeper runtime debugging, the Cloudflare docs also describe how to profile the worker. That is not a first-day concern, but the document should acknowledge it because performance problems are often introduced during platform migrations even when functional tests are green.

### 12.4 Canary and Rollback

Because preview cannot perfectly reproduce production CPU accounting, cache warmup, and traffic shape, the first deploy should be treated as a canary. The canary should have explicit rollback criteria: worker size exceeded, cache freshness regression, binding failures, or request timeouts.

## 13. Risk Register

| Risk | Why it is real | TDD mitigation |
| --- | --- | --- |
| Route regression | Pages render correctly in Node but not in Workers | Characterization tests and worker preview |
| Cache staleness | ISR content becomes stale or inconsistent | Cache tests and R2-backed configuration |
| CPU timeout during generation | Cold `fallback: 'blocking'` work or slow PayloadCMS calls exceed the worker budget | Cold-route preview and backend latency simulation |
| Binding drift | Worker depends on an env resource that is not configured | Contract tests for bindings and config |
| Bundle bloat | Worker exceeds the gzip upload limit | Size gate and dependency review |
| Hidden edge assumptions | A route accidentally starts relying on Edge-only behavior or middleware patterns | Fail fast on edge runtime assumptions |
| Observability gap | The team cannot tell whether a failure came from cache, bindings, or packaging | Production metrics and canary rollout |
| App Router scope creep | The migration becomes two big migrations at once | Keep router migration separate |
| Image mismatch | Image behavior changes during the platform move | Preserve unoptimized behavior first |

### 13.1 What Not to Panic About

Not every warning is a blocker. For example, the Cloudflare docs list many advanced cache and image options that are valid in some setups but unnecessary for this app right now. The right TDD approach is to ignore those until the feature actually appears in the product shape.

That is especially true for App Router-specific caching concepts such as tag cache. They are real features, but they are not current requirements for this repository.

## 14. If App Router Comes Later

If the project eventually decides to adopt App Router, that should be treated as a new architecture track, not as a hidden consequence of the Cloudflare migration. The test plan would expand in the obvious places: route handlers, server components, `revalidateTag`, `revalidatePath`, and any tag-cache or cache-purge behavior required by those features.

The key point is sequencing. Once the site is already stable on Cloudflare Workers, the App Router migration becomes a product refactor instead of a platform migration. That makes the test strategy simpler because the worker runtime is already proven.

## 15. Practical Recommendation for This Repository

For this blog, the architecturally sound move is to keep the current Pages Router, introduce OpenNext Cloudflare as the deployment target, and use TDD to preserve behavior while you wire in Worker-specific cache and binding requirements.

Do not use the Cloudflare migration as the excuse to redesign the app into App Router unless you are ready to own a larger rewrite. The reason is not that App Router is bad. The reason is that it adds an additional axis of change that makes migration diagnosis much harder.

In short, the best test-driven path is:

- freeze current behavior first
- move the deployment target to Cloudflare second
- keep App Router as a later, separate architectural decision

## Appendix A. OpenNext Cloudflare Facts Relevant to This Repo

- OpenNext Cloudflare supports Next 16 minor and patch versions.
- OpenNext Cloudflare supports the Pages Router.
- The adapter expects the Node.js runtime, not the Edge runtime.
- Wrangler 3.99.0 or later is required for deployment.
- The docs recommend `nodejs_compat` and a compatibility date of `2024-09-23` or later in Wrangler.
- For Pages Router `res.revalidate`, a self reference service binding is required if that feature is used.
- `getCloudflareContext({ async: true })` is the build-time path when SSG code needs bindings.
- For ISR, the incremental cache should be backed by R2 rather than KV.
- KV is not recommended for the incremental cache because it is eventually consistent.
- Static assets should use a `public/_headers` rule for long-lived immutable caching.
- Remote bindings should stay opt-in, and older Wrangler versions need the `experimental.remoteBindings` dev flag.
- `NEXT_PRIVATE_DEBUG_CACHE=1` is available for cache debugging.
- Cloudflare image optimization is optional and can be enabled later if the product needs it.
- The worker upload limit is measured on compressed size, not raw artifact size.

## Appendix B. Test Targets Worth Keeping Visible

- `pages/index.tsx`
- `pages/about.tsx`
- `pages/posts/[slug].tsx`
- `pages/categories.tsx`
- `pages/books/[slug].tsx`
- `pages/books/[slug]/chapters/[chapterSlug].tsx`
- `pages/api/posts.ts`
- `pages/api/books.ts`
- `components/shared/lexical-renderer.tsx`
- `common/utils/tags.ts`
- `common/utils/date.ts`
- `common/utils/meta-tags.ts`
- `common/apis/*`
- `public/_headers`
- `wrangler.jsonc`
- `open-next.config.ts`
- `.dev.vars`
- `next.config.mjs`

These are the places where behavior is most likely to change during a Cloudflare migration, so they should anchor the first wave of tests.
