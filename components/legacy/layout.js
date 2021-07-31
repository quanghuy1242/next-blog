import Meta from './meta';
import Header from './header';

export default function Layout({ children }) {
  return (
    <>
      <Meta />
      <main>
        <Header />
        <div className="mt-16" />
        {children}
      </main>
    </>
  );
}
