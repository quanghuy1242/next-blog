import Link from 'next/link';
import cn from 'classnames';

export default function Badge({
  text,
  link,
  enableBorder=false,
  className
}) {
  let defaultStyle = 'bg-gray-400 p-1 pl-2 pr-2 text-xs rounded hover:bg-gray-500'
  let borderStyle = '';
  if (enableBorder) {
    borderStyle = "border-solid border-1 border-gray-500";
  }
  return (
    <span className={cn(className, borderStyle, defaultStyle)}>
      <Link as={link.as} href={link.href} prefetch={false}>
        <a>{text}</a>
      </Link>
    </span>
  );
}