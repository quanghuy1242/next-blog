import type { GetServerSideProps } from 'next';

import { normalizeReturnTo } from 'common/utils/blog-auth';
import { createBlogSignupIntent } from 'common/utils/blog-signup';
import { Container } from 'components/core/container';
import { Layout } from 'components/core/layout';
import { ButtonLink } from 'components/shared/ui/button';
import { CenteredPanel } from 'components/shared/ui/panel';

interface BlogAuthSignupPageProps {
  returnTo: string;
  unavailable?: boolean;
}

export default function BlogAuthSignupPage({
  returnTo,
  unavailable,
}: BlogAuthSignupPageProps) {
  if (!unavailable) {
    return null;
  }

  return (
    <Layout header="Blog" className="flex flex-col items-center">
      <Container className="my-4 w-full md:px-20">
        <CenteredPanel>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue">
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
            >
              Sign in
            </ButtonLink>
            <ButtonLink variant="secondary" href={returnTo}>
              Back to blog
            </ButtonLink>
          </div>
        </CenteredPanel>
      </Container>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ query, req }) => {
  const returnTo = normalizeReturnTo(query.returnTo);

  try {
    const intent = await createBlogSignupIntent({ returnTo, req });

    return {
      redirect: {
        destination: intent.signupUrl,
        permanent: false,
      },
    };
  } catch (error) {
    console.error('[blog-signup] Failed to create signup intent.', error);

    return {
      props: {
        returnTo,
        unavailable: true,
      },
    };
  }
};
