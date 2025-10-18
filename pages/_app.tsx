import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import * as gtag from 'common/gtag';
import { AppWrapper } from 'context/state';
import { useEffect, useRef } from 'react';
import '../styles/index.css';

interface ScrollPosition {
  x: number;
  y: number;
}

type ScrollMap = Record<string, ScrollPosition>;

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const posRef = useRef<ScrollMap>({});

  const savePos = (url: string) => {
    posRef.current[url] = { x: window.scrollX, y: window.scrollY };
  };

  const restorePos = (url: string) => {
    const scrollPos = posRef.current[url];
    if (scrollPos) {
      window.scrollTo(scrollPos.x, scrollPos.y);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if ('scrollRestoration' in window.history) {
      let shouldScrollRestore = false;
      window.history.scrollRestoration = 'manual';
      restorePos(router.asPath);

      const onBeforeUnload = (event: BeforeUnloadEvent) => {
        savePos(router.asPath);
        delete event.returnValue;
      };

      const onRouteChangeStart = () => {
        savePos(router.asPath);
      };

      const onRouteChangeComplete = (url: string) => {
        gtag.pageview(url);
        if (shouldScrollRestore) {
          shouldScrollRestore = false;
          restorePos(url);
        }
      };

      const beforePopStateHandler = () => {
        shouldScrollRestore = true;
        return true;
      };

      window.addEventListener('beforeunload', onBeforeUnload);
      router.events.on('routeChangeStart', onRouteChangeStart);
      router.events.on('routeChangeComplete', onRouteChangeComplete);
      router.beforePopState(beforePopStateHandler);

      return () => {
        window.removeEventListener('beforeunload', onBeforeUnload);
        router.events.off('routeChangeStart', onRouteChangeStart);
        router.events.off('routeChangeComplete', onRouteChangeComplete);
        router.beforePopState(() => true);
      };
    }

    return undefined;
  }, [router]);

  return (
    <AppWrapper>
      <Component {...pageProps} />
    </AppWrapper>
  );
}

export default MyApp;
