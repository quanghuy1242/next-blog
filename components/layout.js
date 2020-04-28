import Meta from './meta'
import Header from './header'

export default function Layout({ preview, children }) {
  return (
    <>
      <Meta />
      <div className="min-h-screen">
        <main>
          <Header />
          <div className="mt-16" />
          {children}
        </main>
      </div>
    </>
  )
}
