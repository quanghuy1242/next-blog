import type { GetServerSideProps } from 'next';

import {
  BLOG_AUTH_COOKIE_MAX_AGE_SECONDS,
  buildAuthorizeUrl,
  createBlogAuthStatePayload,
  encodeBlogAuthStatePayload,
  normalizeReturnTo,
} from 'common/utils/blog-auth';
import { setBlogAuthStateCookie } from 'common/utils/auth-cookies';

export default function BlogAuthLoginPage() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({ query, res }) => {
  const returnTo = normalizeReturnTo(query.returnTo);
  const authState = createBlogAuthStatePayload(returnTo);

  setBlogAuthStateCookie(
    res,
    encodeBlogAuthStatePayload(authState),
    BLOG_AUTH_COOKIE_MAX_AGE_SECONDS
  );

  return {
    redirect: {
      destination: buildAuthorizeUrl(authState),
      permanent: false,
    },
  };
};
