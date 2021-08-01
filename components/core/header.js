import { useAppContext } from 'context/state';
import Link from 'next/link';
import cn from 'classnames';

/**
 * @param {Object} props The props of the component
 * @param {string} props.text Display text
 * @param {string} props.link Hyperlink
 */
const HeaderTitle = ({ text, link }) => {
  return (
    <h3
      className={cn(
        'text-white',
        'text-2xl font-semibold',
        'tracking-tight md:tracking-tighter leading-tight'
      )}
    >
      <Link href={link}>
        <a className="hover:underline whitespace-no-wrap">{text}</a>
      </Link>
    </h3>
  );
};

const OptionItem = ({ name, href }) => {
  return (
    <span
      className={cn(
        'text-white',
        'font-semibold',
        'border-b-2 border-transparent hover:border-white'
      )}
    >
      <Link href={href}>
        <a>{name}</a>
      </Link>
    </span>
  );
};

const Option = ({ items = [] }) => {
  return (
    <div className="flex gap-2">
      {items.map((item) => (
        <OptionItem key={item.name} name={item.name} href={item.href} />
      ))}
    </div>
  );
};

export function Header({ text }) {
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
