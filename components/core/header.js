import { useAppContext } from 'context/state';
import Link from 'next/link';

/**
 * @param {Object} props The props of the component
 * @param {string} props.text Display text
 * @param {string} props.link Hyperlink
 */
const HeaderTitle = ({ text, link }) => {
  return (
    <h3 className="text-2xl font-semibold pl-2 my-2 tracking-tight md:tracking-tighter leading-tight text-white mr-4 z-50">
      <Link href={link}>
        <a className="hover:underline whitespace-no-wrap">{text}</a>
      </Link>
    </h3>
  );
};

export function Header({ text }) {
  const { header } = useAppContext();

  return (
    <div className="bg-blue p-2 shadow-dark fixed w-full h-16 top-0 z-50 flex items-center">
      <HeaderTitle text={text || header} link="/" />
    </div>
  );
}
