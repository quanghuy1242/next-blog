import { Metadata } from './metadata';
import { Header } from './header';
import cn from 'classnames';

export function Layout({ children, className, header }) {
  return (
    <>
      <Metadata />
      <main>
        <Header text={header} />
        <div className="mt-16" />
        <div className={cn(className)}>{children}</div>
      </main>
    </>
  );
}
