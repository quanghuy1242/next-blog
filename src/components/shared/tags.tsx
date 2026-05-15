import React from 'react';
import cn from 'classnames';
import type { LinkProps } from 'next/link';
import { BadgeLink } from '@/components/ui/aria/link';

export interface TagItem {
  name: string;
  href?: LinkProps['href'];
}

interface TagProps {
  text: string;
  href?: LinkProps['href'];
  className?: string;
  primary?: boolean;
}

export function Tag({
  text,
  href = '/',
  className,
  primary = false,
}: TagProps) {
  return (
    <BadgeLink
      href={href}
      prefetch={false}
      primary={primary}
      className={cn(
        'text-xs',
        className || ''
      )}
    >
      {text}
    </BadgeLink>
  );
}

interface TagsProps {
  items?: TagItem[];
}

export function Tags({ items = [] }: TagsProps) {
  return (
    <div className="flex flex-wrap">
      {items.map((item) => (
        <Tag
          text={item.name}
          href={item.href}
          className="mr-1"
          key={`${item.name || 'tag'}-${buildHrefKey(item.href)}`}
        />
      ))}
    </div>
  );
}

function buildHrefKey(href: LinkProps['href'] | undefined): string {
  if (!href) {
    return 'default';
  }

  if (typeof href === 'string') {
    return href;
  }

  return JSON.stringify(href);
}
