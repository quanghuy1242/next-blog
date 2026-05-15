'use client';

import type { AnchorHTMLAttributes, ReactNode } from 'react';
import NextLink from 'next/link';
import type { LinkProps as NextLinkProps } from 'next/link';
import cn from 'classnames';
import { Link as AriaLink } from 'react-aria-components/Link';

interface TextLinkClassNameOptions {
  medium?: boolean;
  className?: string;
}

export function getTextLinkClassName({
  medium = false,
  className,
}: TextLinkClassNameOptions = {}) {
  return cn(
    'link link-hover text-primary',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
    medium ? 'font-medium' : '',
    className
  );
}

export interface TextLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: NextLinkProps['href'];
  children: ReactNode;
  medium?: boolean;
  prefetch?: NextLinkProps['prefetch'];
  hardNavigate?: boolean;
}

export function TextLink({
  href,
  children,
  medium = false,
  prefetch,
  hardNavigate = false,
  className,
  ...props
}: TextLinkProps) {
  const composedClassName = getTextLinkClassName({ medium, className });

  if (hardNavigate || typeof href === 'string' && /^https?:\/\//.test(href)) {
    return (
      <a href={typeof href === 'string' ? href : '#'} className={composedClassName} {...props}>
        {children}
      </a>
    );
  }

  if (typeof href === 'string') {
    return (
      <AriaLink
        href={href}
        className={composedClassName}
        render={(linkProps) => (
          <NextLink
            {...(linkProps as AnchorHTMLAttributes<HTMLAnchorElement>)}
            href={href}
            prefetch={prefetch}
            className={composedClassName}
            {...props}
          >
            {children}
          </NextLink>
        )}
      >
        {children}
      </AriaLink>
    );
  }

  return (
    <NextLink href={href} prefetch={prefetch} className={composedClassName} {...props}>
      {children}
    </NextLink>
  );
}

export interface BadgeLinkProps extends TextLinkProps {
  primary?: boolean;
}

export function BadgeLink({
  primary = false,
  className,
  ...props
}: BadgeLinkProps) {
  return (
    <TextLink
      {...props}
      className={cn(
        'badge no-underline hover:no-underline',
        primary ? 'badge-primary' : 'badge-outline',
        className
      )}
    />
  );
}
