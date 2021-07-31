import cn from 'classnames';
import Link from 'next/link';

export function Tag({ text, link, className, primary = false }) {
  return (
    <span
      className={cn(
        'p-1 px-2 text-xs rounded',
        {
          'bg-gray-300 hover:bg-gray-400': !primary,
          'bg-blue text-white': primary,
        },
        className || ''
      )}
    >
      <Link as={link.as} href={link.href} prefetch={false}>
        <a>{text}</a>
      </Link>
    </span>
  );
}

export function Tags({ items = [] }) {
  return (
    <div className="flex flex-wrap">
      {items.map((item) => (
        <Tag
          text={item.name}
          link={{ as: item.link.as, href: item.link.href }}
          className="mr-1"
          key={item}
        />
      ))}
    </div>
  );
}
