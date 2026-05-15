import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { PageSection } from '@/components/layout/page-section';
import { PageShell } from '@/components/layout/page-shell';
import { ButtonLink } from '@/components/ui/aria/button';
import { CenteredPanel } from '@/components/ui/surface/card';
import { createBlogSignupIntent } from '@/lib/domain/auth/signup';
import { normalizeReturnTo } from '@/lib/domain/auth/oauth';

interface SignupPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BlogAuthSignupPage({ searchParams }: SignupPageProps) {
  const resolvedSearchParams = await searchParams;
  const returnTo = normalizeReturnTo(resolvedSearchParams.returnTo);
  const requestHeaders = await headers();

  let signupUrl: string | null = null;

  try {
    const intent = await createBlogSignupIntent({
      req: {
        headers: {
          host: requestHeaders.get('host') ?? undefined,
          'x-forwarded-host': requestHeaders.get('x-forwarded-host') ?? undefined,
          'x-forwarded-proto': requestHeaders.get('x-forwarded-proto') ?? undefined,
        },
      },
      returnTo,
    });
    signupUrl = intent.signupUrl;
  } catch (error) {
    console.error('[blog-signup] Failed to create signup intent.', error);
  }

  if (signupUrl) {
    redirect(signupUrl);
  }

  return (
    <PageShell className="flex flex-col items-center">
      <PageSection width="full">
        <CenteredPanel>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            Account access
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Sign up is not available
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
            The blog could not start the signup flow. Try again later, or sign in if
            you already have an account.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <ButtonLink
              href={`/auth/login?returnTo=${encodeURIComponent(returnTo)}`}
              size="lg"
              hardNavigate
            >
              Sign in
            </ButtonLink>
            <ButtonLink variant="secondary" href={returnTo} size="lg">
              Back to blog
            </ButtonLink>
          </div>
        </CenteredPanel>
      </PageSection>
    </PageShell>
  );
}
