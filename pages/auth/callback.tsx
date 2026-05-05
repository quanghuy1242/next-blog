import type { GetServerSideProps } from 'next';

import {
  BLOG_AUTH_STATE_COOKIE,
  decodeBlogAuthStatePayload,
  exchangeAuthorizationCode,
  getTokenCookieMaxAgeSeconds,
  isBlogAuthStateExpired,
} from 'common/utils/blog-auth';
import {
  clearBlogAuthStateCookie,
  setBlogAuthTokenCookies,
} from 'common/utils/auth-cookies';

export default function BlogAuthCallbackPage() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({
  query,
  req,
  res,
}) => {
  const pkceCookie = decodeBlogAuthStatePayload(req.cookies?.[BLOG_AUTH_STATE_COOKIE]);
  const fallbackDestination = '/';

  if (!pkceCookie || isBlogAuthStateExpired(pkceCookie)) {
    clearBlogAuthStateCookie(res);

    return {
      redirect: {
        destination: fallbackDestination,
        permanent: false,
      },
    };
  }

  const code = Array.isArray(query.code) ? query.code[0] : query.code;
  const state = Array.isArray(query.state) ? query.state[0] : query.state;

  if (!code || !state || state !== pkceCookie.state) {
    clearBlogAuthStateCookie(res);

    return {
      redirect: {
        destination: pkceCookie.returnTo || fallbackDestination,
        permanent: false,
      },
    };
  }

  try {
    const tokenResponse = await exchangeAuthorizationCode({
      code,
      verifier: pkceCookie.verifier,
    });
    const maxAgeSeconds = getTokenCookieMaxAgeSeconds(tokenResponse.expiresIn);

    setBlogAuthTokenCookies({
      maxAgeSeconds,
      req,
      res,
      token: tokenResponse.accessToken,
    });
  } catch {
    clearBlogAuthStateCookie(res);

    return {
      redirect: {
        destination: pkceCookie.returnTo || fallbackDestination,
        permanent: false,
      },
    };
  }

  clearBlogAuthStateCookie(res);

  return {
    redirect: {
      destination: pkceCookie.returnTo || fallbackDestination,
      permanent: false,
    },
  };
};
