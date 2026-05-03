import type { NextApiRequest, NextApiResponse } from 'next';

import { getBetterAuthTokenFromRequest } from 'common/utils/auth';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionToken = getBetterAuthTokenFromRequest(req);

  res.setHeader('Cache-Control', 'no-store, max-age=0');

  return res.status(200).json({
    isAuthenticated: Boolean(sessionToken),
  });
}
