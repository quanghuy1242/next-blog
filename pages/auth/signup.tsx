import type { GetServerSideProps } from 'next';
import Link from 'next/link';

import { Header } from 'components/core/header';
import { normalizeReturnTo } from 'common/utils/blog-auth';
import { createBlogSignupIntent } from 'common/utils/blog-signup';

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
    <>
      <Header text="Blog" />
      <main className="min-h-screen bg-white px-6 pb-20 pt-36 text-slate-900">
        <section className="mx-auto flex max-w-xl flex-col gap-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue">
            Account access
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Sign up is not available
          </h1>
          <p className="text-base leading-7 text-slate-600">
            The blog could not start the signup flow. Try again later, or sign in if
            you already have an account.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              className="rounded bg-blue px-4 py-2 font-semibold text-white hover:bg-darkBlue"
              href={`/auth/login?returnTo=${encodeURIComponent(returnTo)}`}
            >
              Sign in
            </Link>
            <Link
              className="rounded border border-slate-300 px-4 py-2 font-semibold text-blue hover:border-blue"
              href={returnTo}
            >
              Back to blog
            </Link>
          </div>
        </section>
      </main>
    </>
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
