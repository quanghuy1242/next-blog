import type { GetServerSideProps } from 'next';

import { getBlogPostLogoutRedirectUri, normalizeReturnTo } from 'common/utils/blog-auth';
import { clearBlogAuthStateCookie, clearBlogAuthTokenCookies } from 'common/utils/auth-cookies';

export default function BlogAuthLogoutPage() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({
  query,
  req,
  res,
}) => {
  clearBlogAuthStateCookie(res);
  clearBlogAuthTokenCookies(res, req);

  const requestedReturnTo = normalizeReturnTo(query.returnTo);
  const destination =
    requestedReturnTo !== '/' ? requestedReturnTo : getBlogPostLogoutRedirectUri(req);

  return {
    redirect: {
      destination,
      permanent: false,
    },
  };
};
