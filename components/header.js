import Link from 'next/link'
import { useState } from 'react';
import cn from 'classnames';
import { useAppContext } from '../context/state';

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
  )
}

const Navigator  = ({ isOpen, links = [], children }) => {
  const linkStyle = "md:hover:underline w-full md:w-auto whitespace-no-wrap leading-loose"
  return (
    <div className={cn(
      'flex-grow p-2 md:p-0 justify-end md:flex md:relative', {
        'hidden mr-2': !isOpen,
        'flex flex-col absolute right-0 bg-white rounded-lg shadow-xl mt-3 mr-2 w-64': isOpen
      }
    )}>
      {children}
      {links.map(link => (
        <h3
          className="text-1xl font-semibold pl-2 md:my-2 my-1 tracking-tight md:tracking-tighter leading-tight md:text-white text-black md:mr-4 mr-0 z-50 flex align-middle hover:bg-gray-400 md:hover:bg-blue rounded"
          key={link.slug}
        >
          {!link.external ? (
            <Link href={link.slug}>
              <a className={linkStyle}>{link.name}</a>
            </Link>
          ) : <a className={linkStyle} href={link.slug } target="_blank">{link.name}</a>}
        </h3>
      ))}
    </div>
  )
}

const ToggleButton = ({ isOpen, setIsOpen }) => {
  return (
    <button
      type="button"
      onClick={() => setIsOpen(!isOpen)}
      className="md:hidden flex px-6 items-center lg:hidden text-gray-500 focus:outline-none"
    >
      <svg className="fill-current w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M0 3h20v2H0V3zm0 6h20v2H0V9zm0 6h20v2H0v-2z"></path></svg>
    </button>
  )
}

const SeachBox = () => {
  return (
    <input
      className="md:bg-darkBlue border md:border-0 md:mr-2 mr-0 h-12 appearance-none rounded px-4 mt-1 text-gray-700 leading-tight focus:outline-none focus:bg-white flex-grow md:w-searchBar md:flex-grow-0"
      type="text"
    />
  )
}

const NavigatorSeparator = () => (
  <div className="md:flex-grow-0 flex-grow" />
)

const NavigatorWrapper = ({ children }) => {
  return (
    <div className="justify-end relative">
      {children}
    </div>
  )
}

export default function Header() {
  const { header } = useAppContext()
  const [isOpen, setIsOpen] = useState(false);
  const links = [
    { name: 'Categories', slug: '/categories' },
    { name: 'Showcase', slug: 'https://project-showcase.netlify.app/', external: true },
    { name: 'About', slug: '/about' }
  ];

  return (
    <div className="bg-blue p-2 shadow-dark fixed w-full h-16 top-0 z-50 flex items-center">
      <HeaderTitle text={header} link='/' />
      {/* <NavigatorSeparator />
      <NavigatorWrapper>
        <ToggleButton isOpen={isOpen} setIsOpen={setIsOpen} />
        <Navigator isOpen={isOpen} links={links}>
          <SeachBox />
        </Navigator>
      </NavigatorWrapper> */}
    </div>
  )
}
