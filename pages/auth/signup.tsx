import type { GetServerSideProps } from 'next';
import Link from 'next/link';

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
    <main className="min-h-screen bg-blue px-6 py-24 text-white">
      <section className="mx-auto flex max-w-xl flex-col gap-5">
        <h1 className="text-3xl font-semibold">Sign up is not available</h1>
        <p className="text-base leading-7 text-white/80">
          The blog could not start the signup flow. Try again later, or sign in if
          you already have an account.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            className="rounded bg-white px-4 py-2 font-semibold text-blue"
            href={`/auth/login?returnTo=${encodeURIComponent(returnTo)}`}
          >
            Sign in
          </Link>
          <Link className="rounded border border-white/40 px-4 py-2" href={returnTo}>
            Back to blog
          </Link>
        </div>
      </section>
    </main>
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
