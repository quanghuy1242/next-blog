import Link from 'next/link'

export default function Header() {
  return (
    <div className="bg-blue p-2 shadow-dark fixed w-full h-16 top-0 z-50">
      <h3 className="text-2xl md:text-2xl font-semibold pl-2 mt-2 mb-2 tracking-tight md:tracking-tighter leading-tight text-white">
        <Link href="/">
          <a className="hover:underline">Birdless Sky</a>
        </Link>
      </h3>
    </div>
  )
}
