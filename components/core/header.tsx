import cn from 'classnames';
import { useAppContext } from 'context/state';
import Link from 'next/link';

interface NavigationItem {
  name: string;
  href: string;
}

interface HeaderTitleProps {
  text: string;
  link: string;
}

const HeaderTitle = ({ text, link }: HeaderTitleProps) => {
  return (
    <h3
      className={cn(
        'text-white',
        'text-2xl font-semibold',
        'tracking-tight md:tracking-tighter leading-tight'
      )}
    >
      <Link href={link} className="hover:underline whitespace-no-wrap">
        {text}
      </Link>
    </h3>
  );
};

const OptionItem = ({ name, href }: NavigationItem) => {
  return (
    <span
      className={cn(
        'text-white',
        'font-semibold',
        'border-b-2 border-transparent hover:border-white'
      )}
    >
      <Link href={href}>{name}</Link>
    </span>
  );
};

interface OptionProps {
  items?: NavigationItem[];
}

const Option = ({ items = [] }: OptionProps) => {
  return (
    <div className="flex gap-2">
      {items.map((item) => (
        <OptionItem key={item.name} name={item.name} href={item.href} />
      ))}
    </div>
  );
};

interface HeaderProps {
  text?: string | null;
}

export function Header({ text }: HeaderProps) {
  const { header } = useAppContext();

  return (
    <div
      className={cn(
        'flex items-center',
        'fixed w-full h-16 top-0 z-50',
        'py-2 px-4',
        'bg-blue shadow-dark'
      )}
    >
      <HeaderTitle text={text || header} link="/" />
      <div className="flex-grow" />
      <Option items={[{ name: 'About me', href: '/about' }]} />
    </div>
  );
}
