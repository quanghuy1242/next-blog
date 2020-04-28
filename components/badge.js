import Link from 'next/link';
import cn from 'classnames';

export default function Badge({
  text,
  link,
  className
}) {
  return (
    <span className={cn(className, 'bg-gray-400 p-1 pl-2 pr-2 text-xs rounded hover:bg-gray-500')}>
      <Link as={link.as} href={link.href}>
        <a>{text}</a>
      </Link>
    </span>
  );
}