export default function PostTitle({ children }) {
  return (
    <h1 className="text-4xl font-bold tracking-tighter leading-tight md:leading-none mb-4 text-center md:text-left">
      {children}
    </h1>
  )
}
