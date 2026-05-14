import type { AnchorHTMLAttributes, ReactNode } from 'react';
import Link from 'next/link';
import type { LinkProps } from 'next/link';
import cn from 'classnames';
import { SSRPrefetchLink } from '@/components/shared/ssr-prefetch-link';

interface TextLinkClassNameOptions {
  medium?: boolean;
  className?: string;
}

export function getTextLinkClassName({
  medium = false,
  className,
}: TextLinkClassNameOptions = {}) {
  return cn('text-blue hover:underline', medium ? 'font-medium' : '', className);
}

interface TextLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: LinkProps['href'];
  children: ReactNode;
  medium?: boolean;
  ssrPrefetch?: boolean;
  prefetch?: LinkProps['prefetch'];
}

export function TextLink({
  href,
  children,
  medium = false,
  ssrPrefetch = false,
  prefetch,
  className,
  ...props
}: TextLinkProps) {
  const composedClassName = getTextLinkClassName({ medium, className });

  if (ssrPrefetch && typeof href === 'string') {
    return (
      <SSRPrefetchLink href={href} prefetch={prefetch} className={composedClassName} {...props}>
        {children}
      </SSRPrefetchLink>
    );
  }

  return (
    <Link href={href} prefetch={prefetch} className={composedClassName} {...props}>
      {children}
    </Link>
  );
}
