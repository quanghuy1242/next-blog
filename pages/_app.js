import '../styles/index.css'
import Router from 'next/router'
import * as gtag from '../lib/gtag'
import { AppWrapper } from '../context/state'
import useScrollRestoration from '../lib/scrollRestoration';

// Notice how we track pageview when route is changed
Router.events.on('routeChangeComplete', (url) => gtag.pageview(url));

function MyApp({ Component, pageProps, router }) {
  // The hacky way to fix the restore scroll position
  useScrollRestoration(router);
  return (
    <AppWrapper>
      <Component {...pageProps} />
    </AppWrapper>
  )
}

export default MyApp
