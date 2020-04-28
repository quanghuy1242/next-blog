import Link from 'next/link'
import { useState } from 'react';
import cn from 'classnames';

export default function Header() {
  const links = [
    { name: 'Categories', slug: '/categories' },
    { name: 'Showcase', slug: '#' }
  ];

  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-blue p-2 shadow-dark fixed w-full h-16 top-0 z-50 flex items-center">
      <h3 className="text-2xl font-semibold pl-2 my-2 tracking-tight md:tracking-tighter leading-tight text-white mr-4 z-50">
        <Link href="/">
          <a className="hover:underline whitespace-no-wrap">Birdless Sky</a>
        </Link>
      </h3>
      <div className="md:flex-grow-0 flex-grow" />
      <div className="md:w-full justify-end relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="md:hidden flex px-6 items-center lg:hidden text-gray-500 focus:outline-none"
        >
          <svg className="fill-current w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M0 3h20v2H0V3zm0 6h20v2H0V9zm0 6h20v2H0v-2z"></path></svg>
        </button>
        <div className={cn(
          'flex-grow p-2 md:p-0 justify-end md:flex md:relative', {
            'hidden mr-2': !isOpen,
            'flex flex-col absolute right-0 bg-white rounded-lg shadow-xl mt-3 mr-2 w-64': isOpen
          }
        )}>
          <input
            className="md:bg-darkBlue border md:border-0 md:mr-2 mr-0 h-12 appearance-none rounded px-4 mt-1 text-gray-700 leading-tight focus:outline-none focus:bg-white flex-grow md:w-searchBar md:flex-grow-0"
            type="text"
          />
          {links.map(link => (
            <h3
              className="text-1xl font-semibold pl-2 md:my-2 my-1 tracking-tight md:tracking-tighter leading-tight md:text-white text-black md:mr-4 mr-0 z-50 flex align-middle hover:bg-gray-400 md:hover:bg-blue rounded"
              key={link.slug}
            >
              <Link href={link.slug}>
                <a className="md:hover:underline w-full md:w-auto whitespace-no-wrap leading-loose">{link.name}</a>
              </Link>
            </h3>
          ))}
        </div>
      </div>
    </div>
  )
}
