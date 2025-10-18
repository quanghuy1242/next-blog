import cn from 'classnames';
import Link from 'next/link';

export interface TagItem {
  name: string;
  href?: string;
}

interface TagProps {
  text: string;
  href?: string;
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
    <Link
      href={href}
      prefetch={false}
      className={cn(
        'inline-block p-1 px-2 text-xs rounded',
        {
          'bg-gray-300 hover:bg-gray-400': !primary,
          'bg-blue text-white': primary,
        },
        className || ''
      )}
    >
      {text}
    </Link>
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
          key={`${item.href || 'href'}-${item.name || 'tag'}`}
        />
      ))}
    </div>
  );
}
