import Link from 'next/link';
import type { AnchorHTMLAttributes, ReactNode } from 'react';

interface SSRPrefetchLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  children: ReactNode;
}

/**
 * App Router-compatible link wrapper.
 *
 * The old custom route warmup scheduler was removed during the App Router
 * migration because it was built around Pages Router `/_next/data` requests.
 *
 * This component now preserves the shared "prefetch this route" call sites
 * while delegating the actual behavior to App Router `next/link` prefetching.
 * That means callers still get Next's route/module/data prefetch behavior, but
 * not the previous custom hover/viewport/pointer scheduling contract described
 * in `docs/route-prefetch.md`.
 */
export function SSRPrefetchLink({
  href,
  children,
  ...rest
}: SSRPrefetchLinkProps) {
  return (
    <Link href={href} prefetch {...rest}>
      {children}
    </Link>
  );
}
