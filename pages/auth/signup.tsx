import type { GetServerSideProps } from 'next';

import { normalizeReturnTo } from 'common/utils/blog-auth';
import { createBlogSignupIntent } from 'common/utils/blog-signup';

export default function BlogAuthSignupPage() {
  return null;
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
  } catch {
    return {
      redirect: {
        destination: `/auth/login?returnTo=${encodeURIComponent(returnTo)}&signup=unavailable`,
        permanent: false,
      },
    };
  }
};
