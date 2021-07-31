import * as gtag from 'common/gtag';
import { AppWrapper } from 'context/state';
import Router from 'next/router';
import { useEffect, useRef } from 'react';
import '../styles/index.css';

function MyApp({ Component, pageProps, router }) {
  // Using useRef to avoid unwanted re-render
  const posRef = useRef({});

  /**
   * Save current scroll position
   * @param {string} url Page path
   */
  const savePos = (url) => {
    const scrollPos = { x: window.scrollX, y: window.scrollY };
    posRef.current = { ...posRef.current, [url]: scrollPos };
  };

  /**
   * Restore scroll position of the provided path
   * @param {string} url Page path
   */
  const restorePos = (url) => {
    const scrollPos = posRef.current[url];
    if (scrollPos) {
      window.scrollTo(scrollPos.x, scrollPos.y);
    }
  };

  // The hacky way to fix the restore scroll position
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      let shouldScrollRestore = false;
      window.history.scrollRestoration = 'manual';
      restorePos(router.asPath, posRef);

      const onBeforeUnload = (event) => {
        savePos(router.asPath, posRef);
        delete event['returnValue'];
      };

      const onRouteChangeStart = () => {
        savePos(router.asPath, posRef);
      };

      const onRouteChangeComplete = (url) => {
        // Send static about current page to Google Analyzes
        gtag.pageview(url);
        if (shouldScrollRestore) {
          shouldScrollRestore = false;
          restorePos(url, posRef);
        }
      };

      window.addEventListener('beforeunload', onBeforeUnload);
      Router.events.on('routeChangeStart', onRouteChangeStart);
      Router.events.on('routeChangeComplete', onRouteChangeComplete);
      Router.beforePopState(() => {
        shouldScrollRestore = true;
        return true;
      });

      return () => {
        window.removeEventListener('beforeunload', onBeforeUnload);
        Router.events.off('routeChangeStart', onRouteChangeStart);
        Router.events.off('routeChangeComplete', onRouteChangeComplete);
        Router.beforePopState(() => true);
      };
    }
  }, [router]);
  return (
    <AppWrapper>
      <Component {...pageProps} />
    </AppWrapper>
  );
}

export default MyApp;
