import Link from 'next/link'

export default function Header() {
  return (
    <div className="bg-blue p-2 shadow-dark fixed w-full h-16 top-0 z-50 flex items-center">
      <h3 className="text-2xl font-semibold pl-2 my-2 tracking-tight md:tracking-tighter leading-tight text-white mr-4 z-50">
        <Link href="/">
          <a className="hover:underline whitespace-no-wrap md:hidden">BS</a>
        </Link>
        <Link href="/">
          <a className="hover:underline whitespace-no-wrap hidden md:block">Birdless Sky</a>
        </Link>
      </h3>
      <div className="md:absolute md:top-0 md:bottom-0 md:left-0 md:right-0 md:flex md:items-center md:justify-center flex flex-grow justify-end">
        <input
          className="bg-darkBlue h-12 appearance-none rounded px-4 mt-1 text-gray-700 leading-tight focus:outline-none focus:bg-white flex-grow md:w-searchBar md:-ml-10 md:flex-grow-0"
          type="text"
        />
      </div>
    </div>
  )
}
